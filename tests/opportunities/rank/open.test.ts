// SPEC §7 (2026-09-16) — the daily decision: update or new, whichever ranks
// higher for this site (#780). SPEC §6 (2026-10-02, #1181) — score first,
// and no two consecutive days on one topic.
import "../env";
import { describe, expect, it } from "vitest";
import { nearRepeatsOf } from "../../../src/lib/opportunities/cluster";
import { orderRanked } from "../../../src/lib/opportunities/rank/open";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-09-06T09:00:00.000Z");

function opportunity(id: string, family: Opportunity["family"], type: Opportunity["type"], targetQuery = id): Opportunity {
  const evidence = family === "improve" ? { family, shortfall: { kind: "position" } } : { family };
  return { id, family, type, status: "open", clusterKey: null, targetQuery, absorbedQueries: [], evidence, createdAt: AT } as unknown as Opportunity;
}

const order = (scored: { opportunity: Opportunity; score: number }[], rotation?: Parameters<typeof orderRanked>[1]) =>
  orderRanked(scored, rotation).map((entry) => entry.opportunityId);

describe("orderRanked — update against new", () => {
  it("an update that scores higher goes first, and takes a tie", () => {
    expect(
      order([
        { opportunity: opportunity("write", "write", "answer_page"), score: 0.4 },
        { opportunity: opportunity("improve", "improve", "answerable_page"), score: 0.6 },
      ])
    ).toEqual(["improve", "write"]);
    expect(
      order([
        { opportunity: opportunity("write", "write", "answer_page"), score: 0.5 },
        { opportunity: opportunity("improve", "improve", "answerable_page"), score: 0.5 },
      ])
    ).toEqual(["improve", "write"]);
  });

  it("the score orders every type; family and type only break a tie (#1181)", () => {
    expect(
      order([
        { opportunity: opportunity("keyword", "write", "keyword_page"), score: 0.9 },
        { opportunity: opportunity("answer", "write", "answer_page"), score: 0.2 },
        { opportunity: opportunity("earn", "earn", "listed_page"), score: 0.3 },
        { opportunity: opportunity("improve", "improve", "answerable_page"), score: 0.1 },
      ])
    ).toEqual(["keyword", "earn", "answer", "improve"]);
    expect(
      order([
        { opportunity: opportunity("keyword", "write", "keyword_page"), score: 0.5 },
        { opportunity: opportunity("answer", "write", "answer_page"), score: 0.5 },
        { opportunity: opportunity("earn", "earn", "listed_page"), score: 0.5 },
      ])
    ).toEqual(["earn", "answer", "keyword"]);
  });
});

describe("orderRanked — rotation (#1181)", () => {
  const SAME = ["zapier.com/a", "marketermilk.com/b", "morningscore.io/c", "gartner.com/d"];
  const topTens = new Map([
    ["best seo software", SAME],
    ["what is the best seo software", [...SAME, "other.example/e"]],
    ["seo software pricing", ["semrush.com/pricing", "nutshell.com/cost"]],
  ]);
  const best = opportunity("best", "earn", "listed_page", "best seo software");
  const whatIs = opportunity("what-is", "earn", "listed_page", "what is the best seo software");
  const pricing = opportunity("pricing", "earn", "listed_page", "seo software pricing");

  it("never puts two rows whose top tens are one topic on consecutive days", () => {
    expect(
      order(
        [
          { opportunity: best, score: 0.9 },
          { opportunity: whatIs, score: 0.8 },
          { opportunity: pricing, score: 0.1 },
        ],
        { topTens }
      )
    ).toEqual(["best", "pricing", "what-is"]);
  });

  it("the first day turns away from the page drafted last", () => {
    expect(
      order(
        [
          { opportunity: whatIs, score: 0.8 },
          { opportunity: pricing, score: 0.1 },
        ],
        { after: best, topTens }
      )
    ).toEqual(["pricing", "what-is"]);
  });

  it("orders and never empties a day: a list of one topic keeps its rows", () => {
    expect(order([{ opportunity: whatIs, score: 0.8 }], { after: best, topTens })).toEqual(["what-is"]);
  });

  it("a page drafted folds its open repeats, and only them", () => {
    const local = opportunity("local", "write", "answer_page", "best local seo software");
    const improve = opportunity("improve", "improve", "refresh_page", "best seo software");
    expect(nearRepeatsOf(best, [best, whatIs, pricing, local, improve], topTens).map((o) => o.id)).toEqual(["what-is"]);
  });
});
