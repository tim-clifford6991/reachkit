// SPEC §7 — the one list: integer points, an update and a new page on one
// scale, and no two consecutive days on one topic.
import "../env";
import { describe, expect, it } from "vitest";
import { nearRepeatsOf } from "../../../src/lib/opportunities/cluster";
import { orderRanked, type Scored } from "../../../src/lib/opportunities/rank/open";
import { pointsOf } from "../../../src/lib/opportunities/rank/points";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-09-06T09:00:00.000Z");

function opportunity(id: string, family: Opportunity["family"], type: Opportunity["type"], targetQuery = id): Opportunity {
  const evidence = family === "improve" ? { family, shortfall: { kind: "position" } } : { family };
  return { id, family, type, status: "open", clusterKey: null, targetQuery, absorbedQueries: [], evidence, createdAt: AT } as unknown as Opportunity;
}

const order = (scored: Scored[], rotation?: Parameters<typeof orderRanked>[1]) =>
  orderRanked(scored, rotation).map((entry) => entry.opportunityId);
const at = (points: number, o: Opportunity): Scored => ({ opportunity: o, points, parts: [] });
const NOTHING_SEEN = { cited: new Set<string>(), prompts: [] };

describe("orderRanked — the most points first", () => {
  it("points order every type and family; a tie goes to the larger measured volume, then the older row, then the id", () => {
    expect(
      order([
        at(2, opportunity("keyword", "write", "keyword_page")),
        at(6, opportunity("improve", "improve", "answerable_page")),
        at(4, opportunity("earn", "earn", "listed_page")),
      ])
    ).toEqual(["improve", "earn", "keyword"]);
    const volume = (id: string, value: number | null, created = AT) =>
      ({ ...opportunity(id, "write", "answer_page"), createdAt: created, volume: value === null ? { kind: "unmeasured", reason: "not_attempted", at: AT } : { kind: "measured", value, at: AT } }) as unknown as Opportunity;
    expect(order([at(3, volume("unmeasured", null)), at(3, volume("small", 20)), at(3, volume("big", 900))])).toEqual(["big", "small", "unmeasured"]);
    const older = new Date(AT.getTime() - 1000);
    expect(order([at(3, volume("b", 50)), at(3, volume("c", 50, older)), at(3, volume("a", 50))])).toEqual(["c", "a", "b"]);
  });

  it("each placed row carries its points, their parts and the rule that placed it", () => {
    const [placed] = orderRanked([{ opportunity: opportunity("one", "write", "answer_page"), points: 4, parts: [{ part: "fit", n: 3 }, { part: "demand", n: 1 }] }]);
    expect(placed?.reason).toEqual({ points: 4, parts: [{ part: "fit", n: 3 }, { part: "demand", n: 1 }], rule: "best" });
  });
});

describe("pointsOf — integer points from what the row holds", () => {
  const POST = "https://example.com/blog/post";
  const measuredVolume = (value: number) => ({ kind: "measured", value, at: AT });
  const write = (over: Record<string, unknown> = {}) =>
    ({ ...opportunity("w", "write", "answer_page", "how to plan a kitchen refit"), businessFit: 3, volume: measuredVolume(140), ...over }) as unknown as Opportunity;
  const update = (shortfall: unknown, over: Record<string, unknown> = {}) =>
    ({
      ...opportunity("u", "improve", "refresh_page", "kitchen refit cost"),
      businessFit: 2,
      volume: measuredVolume(90),
      evidence: { family: "improve", pageUrl: POST, shortfall },
      ...over,
    }) as unknown as Opportunity;
  const sum = (reason: { points: number; parts: { n: number }[] }) => reason.parts.reduce((total, part) => total + part.n, 0);

  it("fit 3 is 3 and fit 2 is 1; a search measured at 10 a month or more is 2; an AI answer linking a competitor is 2", () => {
    const reason = pointsOf(write({ source: "ai_gap" }), NOTHING_SEEN);
    expect(reason).toEqual({ points: 7, parts: [{ part: "fit", n: 3 }, { part: "demand", n: 2 }, { part: "ai_gap", n: 2 }] });
    expect(pointsOf(write({ businessFit: 2 }), NOTHING_SEEN).parts[0]).toEqual({ part: "fit", n: 1 });
    expect(pointsOf(write({ businessFit: 1 }), NOTHING_SEEN).parts.map((part) => part.part)).not.toContain("fit");
  });

  it("an unmeasured search counts as asked only where a buyer was seen asking it or a tracked prompt matches it", () => {
    const unmeasured = { kind: "unmeasured", reason: "not_attempted", at: AT };
    expect(pointsOf(write({ volume: unmeasured }), NOTHING_SEEN).parts.map((part) => part.part)).toEqual(["fit"]);
    const prompts = [{ id: "p1", text: "how should I plan a kitchen refit" }];
    expect(pointsOf(write({ volume: unmeasured }), { cited: new Set(), prompts }).parts).toContainEqual({ part: "demand", n: 1 });
    const asked = write({ volume: unmeasured, evidence: { family: "write", askedBeside: { term: "kitchen refit", serpAt: AT } } });
    expect(pointsOf(asked, NOTHING_SEEN).parts).toContainEqual({ part: "demand", n: 1 });
  });

  it("a page of ours near page one is 3, one an AI answer links is 1 more, and one not moving is named at 0", () => {
    const near = { kind: "due", cause: "close", since: measuredVolume(0) };
    expect(pointsOf(update(near), NOTHING_SEEN).parts).toContainEqual({ part: "near_page_one", n: 3 });
    const position = (value: number) => ({ kind: "position", position: measuredVolume(value) });
    expect(pointsOf(update(position(11)), NOTHING_SEEN).parts).toContainEqual({ part: "near_page_one", n: 3 });
    expect(pointsOf(update(position(25)), NOTHING_SEEN).parts.map((part) => part.part)).not.toContain("near_page_one");
    const linked = pointsOf(update(position(25)), { cited: new Set(["example.com/blog/post"]), prompts: [] });
    expect(linked.parts).toContainEqual({ part: "linked_by_ai", n: 1 });
    const stalled = pointsOf(update({ kind: "due", cause: "unmet", since: measuredVolume(0) }), NOTHING_SEEN);
    expect(stalled.parts).toContainEqual({ part: "not_moving", n: 0 });
  });

  it("the stored points are always the sum of the stored parts", () => {
    const rows = [
      write(),
      write({ source: "ai_gap", businessFit: 2 }),
      update({ kind: "due", cause: "close", since: measuredVolume(0) }),
      update({ kind: "due", cause: "unmet", since: measuredVolume(0) }),
    ];
    for (const row of rows) {
      const reason = pointsOf(row, { cited: new Set(["example.com/blog/post"]), prompts: [] });
      expect(reason.points).toBe(sum(reason));
    }
  });

  it("a page near page one goes ahead of a new page of the same fit with measured demand", () => {
    const fresh = write({ businessFit: 2 });
    const near = update({ kind: "position", position: measuredVolume(14) });
    const scored = [fresh, near].map((o) => ({ opportunity: o, ...pointsOf(o, NOTHING_SEEN) }));
    expect(order(scored)).toEqual(["u", "w"]);
  });
});

describe("orderRanked — rotation (#1181)", () => {
  const SAME = ["zapier.com/a", "marketermilk.com/b", "morningscore.io/c", "gartner.com/d"];
  const topTens = new Map([
    ["seo software for agencies", SAME],
    ["what is seo software for agencies", [...SAME, "other.example/e"]],
    ["seo software pricing", ["semrush.com/pricing", "nutshell.com/cost"]],
  ]);
  // Not comparisons: D52 caps those apart from the rotation (issue 1267).
  const best = opportunity("best", "write", "keyword_page", "seo software for agencies");
  const whatIs = opportunity("what-is", "write", "keyword_page", "what is seo software for agencies");
  const pricing = opportunity("pricing", "write", "keyword_page", "seo software pricing");

  it("never puts two rows whose top tens are one topic on consecutive days", () => {
    expect(
      order(
        [
          at(9, best),
          at(8, whatIs),
          at(1, pricing),
        ],
        { topTens }
      )
    ).toEqual(["best", "pricing", "what-is"]);
  });

  it("the first day turns away from the page drafted last", () => {
    expect(
      order(
        [
          at(8, whatIs),
          at(1, pricing),
        ],
        { after: best, topTens }
      )
    ).toEqual(["pricing", "what-is"]);
  });

  it("orders and never empties a day: a list of one topic keeps its rows", () => {
    expect(order([at(8, whatIs)], { after: best, topTens })).toEqual(["what-is"]);
  });

  it("a page drafted folds its open repeats, and only them", () => {
    const local = opportunity("local", "write", "answer_page", "best local seo software");
    const improve = opportunity("improve", "improve", "refresh_page", "best seo software");
    expect(nearRepeatsOf(best, [best, whatIs, pricing, local, improve], topTens).map((o) => o.id)).toEqual(["what-is"]);
  });
});
