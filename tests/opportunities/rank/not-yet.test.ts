// tests/opportunities/rank/not-yet.test.ts — SPEC §6's right-sizing law,
// enforced (issue 881).
//
// The owner's dogfood, 2026-09-18: ReachKit wrote its own first page for
// "best seo software" (1 000/mo) against a top ten of zapier.com (218 224
// ranked), ahrefs.com (59 767) and marketermilk.com (7 070), for a site
// ranking for 3. Every one of that site's six write opportunities carried
// `fit_band: not-yet`, which weighs 0 in the score — and where every
// candidate scores 0 the order is a tie, so the tie-break handed the day to
// the biggest keyword. The comment said the formula could not surface such
// a target; the code did not enforce it.
//
// Everything here is the real engine over the in-memory store: `rankOpen`,
// `nextForDay`, `supplyDepth` and `supplyState` as they run in production,
// with the rows in a Map.
import "../env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setOpportunityStore, type OpportunityRow } from "../../../src/lib/opportunities/store";
import { rankOpen } from "../../../src/lib/opportunities/rank/open";
import { nextForDay } from "../../../src/lib/opportunities/next";
import { supplyDepth, supplyState } from "../../../src/lib/opportunities/supply/depth";
import { qualifiesForADay } from "../../../src/lib/opportunities/types";
import { measured } from "../../../src/lib/measure/measured";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { AT, PROFILE, SCAN_ID, SITE_ID, defaultReport } from "../fixtures";

let state: MemoryState;

/** One open, ready Write row, as the dogfood site's six were stored.
 *  `answer_page`: §6's keyword gate already refuses an outsized
 *  `keyword_page`, so the type that reached a publishing day is the one
 *  with no gate of its own. */
function row(over: Partial<OpportunityRow> & { id: string }): OpportunityRow {
  const query = over.target_query ?? "best seo software";
  return {
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: query,
    target_ref: String(query).replace(/[^a-z0-9]+/g, "-"),
    proposed_slug: null,
    title: null,
    volume: 1000,
    evidence: {
      family: "write",
      query,
      volume: measured(1000, AT),
      rival: {
        domain: "zapier.com",
        url: measured("https://zapier.com/blog/seo", AT),
        position: measured(1, AT),
      },
    },
    acceptance: { form: "named_on", question: `What is the best ${query}?` },
    fit_band: "not-yet",
    effort: 0.5,
    status: "open",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    created_at: AT.toISOString(),
    ...over,
  } as OpportunityRow;
}

/** The dogfood shape: six targets, every one outsized for the site. */
const OUTSIZED_SIX: readonly OpportunityRow[] = [
  row({ id: "opp-1", target_query: "best seo software", volume: 1000 }),
  row({ id: "opp-2", target_query: "seo software tool", volume: 880 }),
  row({ id: "opp-3", target_query: "ai tool for seo", volume: 880 }),
  row({ id: "opp-4", target_query: "seo software for startups", volume: 260 }),
  row({ id: "opp-5", target_query: "best seo tools", volume: 720 }),
  row({ id: "opp-6", target_query: "seo platform", volume: 590 }),
];

beforeEach(() => {
  state = newMemoryState({ profile: PROFILE, report: defaultReport() });
  setOpportunityStore(memoryStore(state));
});

afterEach(() => {
  setOpportunityStore(null);
});

describe("a not-yet target is never the day's page (issue 881)", () => {
  it("the dogfood site: six outsized targets rank nothing, and the day has no page", async () => {
    state.rows = [...OUTSIZED_SIX];

    expect(await rankOpen(SITE_ID)).toEqual([]);
    expect(await nextForDay(SITE_ID)).toBeNull();
  });

  it("the tie-break can no longer hand the day to the biggest keyword", async () => {
    state.rows = [...OUTSIZED_SIX];
    const ranked = await rankOpen(SITE_ID);
    expect(ranked.map((entry) => entry.opportunityId)).not.toContain("opp-1");
    // And not by scoring it last: it is not in the list at all.
    expect(ranked).toHaveLength(0);
  });

  it("a mixed list ranks only the targets that qualify, and the day takes one of them", async () => {
    state.rows = [
      ...OUTSIZED_SIX,
      row({
        id: "opp-winnable",
        target_query: "seo content brief template for startups",
        volume: 40,
        fit_band: "winnable",
      }),
      row({ id: "opp-reach", target_query: "seo brief software", volume: 90, fit_band: "reach" }),
    ];

    const ranked = await rankOpen(SITE_ID);
    expect(ranked.map((entry) => entry.opportunityId).sort()).toEqual(["opp-reach", "opp-winnable"]);
    expect((await nextForDay(SITE_ID))?.fitBand).not.toBe("not-yet");
  });

  it("the rule is the predicate, not a weight — `qualifiesForADay` is total over the three bands", () => {
    expect(qualifiesForADay("winnable")).toBe(true);
    expect(qualifiesForADay("reach")).toBe(true);
    expect(qualifiesForADay("not-yet")).toBe(false);
    // A row with no band at all never fills a day either.
    expect(qualifiesForADay(null)).toBe(false);
  });
});

describe("an outsized target is not supply, and the zero says why (issue 881)", () => {
  it("six outsized targets are zero days of pages", async () => {
    state.rows = [...OUTSIZED_SIX];
    expect((await supplyDepth(SITE_ID)).unused).toBe(0);
  });

  it("that zero is `outsized` — neither a used-up market nor an unmeasured one", async () => {
    state.rows = [...OUTSIZED_SIX];
    expect(await supplyState(SITE_ID)).toBe("outsized");
  });

  it("a qualifying target is counted as before, and the state falls back to the measured arms", async () => {
    state.rows = [...OUTSIZED_SIX, row({ id: "opp-winnable", volume: 40, fit_band: "winnable" })];
    expect((await supplyDepth(SITE_ID)).unused).toBe(1);

    state.rows = [];
    expect(await supplyState(SITE_ID)).not.toBe("outsized");
  });
});
