// SPEC §7 (2026-09-16) — the daily decision: update or new, whichever ranks
// higher for this site (#780).
import "../env";
import { describe, expect, it } from "vitest";
import { orderRanked } from "../../../src/lib/opportunities/rank/open";
import type { Opportunity } from "../../../src/lib/opportunities/types";

const AT = new Date("2026-09-06T09:00:00.000Z");

function opportunity(id: string, family: Opportunity["family"], type: Opportunity["type"]): Opportunity {
  return { id, family, type, clusterKey: null, createdAt: AT } as Opportunity;
}

const order = (scored: { opportunity: Opportunity; score: number }[]) =>
  orderRanked(scored).map((entry) => entry.opportunityId);

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

  it("an update outsized for the site (fit 0, score 0) no longer jumps a winnable new page", () => {
    expect(
      order([
        { opportunity: opportunity("improve", "improve", "expand_page"), score: 0 },
        { opportunity: opportunity("write", "write", "keyword_page"), score: 0.3 },
      ])
    ).toEqual(["write", "improve"]);
  });

  it("new pages keep their own order — Earn, then the Write types — while updates merge in by score", () => {
    expect(
      order([
        { opportunity: opportunity("keyword", "write", "keyword_page"), score: 0.9 },
        { opportunity: opportunity("answer", "write", "answer_page"), score: 0.2 },
        { opportunity: opportunity("earn", "earn", "listed_page"), score: 0.3 },
        { opportunity: opportunity("improve-low", "improve", "answerable_page"), score: 0.1 },
        { opportunity: opportunity("improve-high", "improve", "answerable_page"), score: 0.35 },
      ])
    ).toEqual(["improve-high", "earn", "answer", "keyword", "improve-low"]);
  });
});
