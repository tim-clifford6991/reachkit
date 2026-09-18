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
// Everything here is the real engine over the in-memory store:
// `assessReadiness`, `rankOpen`, `nextForDay`, `supplyDepth` and
// `supplyState` as they run in production, with the rows in a Map.
//
// Issue 884 moved the decision to its one home. The rows are seeded as
// derivation leaves them and **readiness is run first**, exactly as the
// daily job runs it; the ranking then reads the stored answer. The last
// case here is the one that proves there is no second filter left: a row
// forced to `ready: true` while outsized — a state derivation never writes
// — is ranked, because the read layer holds no policy of its own.
import "../env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setOpportunityStore, type OpportunityRow } from "../../../src/lib/opportunities/store";
import { assessReadiness } from "../../../src/lib/opportunities/readiness";
import { rankOpen } from "../../../src/lib/opportunities/rank/open";
import { nextForDay } from "../../../src/lib/opportunities/next";
import { supplyDepth, supplyState } from "../../../src/lib/opportunities/supply/depth";
import { qualifiesForADay } from "../../../src/lib/opportunities/types";
import { rebandFor } from "../../../src/lib/opportunities/readiness";
import { measured } from "../../../src/lib/measure/measured";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { readOpportunity as readRow } from "../../../src/lib/opportunities/store";
import { AT, PROFILE, SCAN_ID, SITE_ID, defaultReport } from "../fixtures";

let state: MemoryState;

/** One open, ready Write row, as the dogfood site's six were stored.
 *  `answer_page`: §6's keyword gate already refuses an outsized
 *  `keyword_page`, so the type that reached a publishing day is the one
 *  with no gate of its own. */
function row(over: Partial<OpportunityRow> & { id: string }): OpportunityRow {
  const query = over.target_query ?? "best seo software";
  // The measurement rides in `evidence` and the column is its denormalised
  // copy (`persist.ts`), so the two are built from one number here — a row
  // whose column and evidence disagreed would be a fixture no derivation
  // could write.
  const volume = over.volume ?? 1000;
  return {
    site_id: SITE_ID,
    scan_id: SCAN_ID,
    type: "answer_page",
    family: "write",
    target_query: query,
    target_ref: String(query).replace(/[^a-z0-9]+/g, "-"),
    proposed_slug: null,
    title: null,
    volume,
    evidence: {
      family: "write",
      query,
      volume: measured(volume, AT),
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
    // As derivation writes it: nothing has assessed the row yet.
    ready: false,
    unready_reason: "not_assessed",
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
  it("the dogfood site: six outsized targets are stored unready, rank nothing, and the day has no page", async () => {
    state.rows = [...OUTSIZED_SIX];
    await assessReadiness(SITE_ID, { at: AT });

    // The decision is on the row, in the reason the founder can be told.
    expect(state.rows.map((row) => [row.ready, row.unready_reason])).toEqual(
      OUTSIZED_SIX.map(() => [false, "outsized"])
    );
    expect(await rankOpen(SITE_ID)).toEqual([]);
    expect(await nextForDay(SITE_ID)).toBeNull();
  });

  it("the tie-break can no longer hand the day to the biggest keyword", async () => {
    state.rows = [...OUTSIZED_SIX];
    await assessReadiness(SITE_ID, { at: AT });
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
    await assessReadiness(SITE_ID, { at: AT });

    const ranked = await rankOpen(SITE_ID);
    expect(ranked.map((entry) => entry.opportunityId).sort()).toEqual(["opp-reach", "opp-winnable"]);
    expect((await nextForDay(SITE_ID))?.fitBand).not.toBe("not-yet");
  });

  it("issue 884 — the ranking holds no policy: a row stored ready while outsized is ranked", async () => {
    // Derivation never writes this state; `readiness.ts` would store it
    // `ready: false` with the reason `outsized`. It is forced here to prove
    // that the ranking reads the stored answer and no longer re-applies the
    // law itself — the duplication issue 881 introduced and this one
    // collapsed. If a future edit puts a `fit_band` filter back into
    // `rankOpen`, this case fails.
    state.rows = [row({ id: "forced", ready: true, unready_reason: null })];

    expect((await rankOpen(SITE_ID)).map((entry) => entry.opportunityId)).toEqual(["forced"]);
    // And readiness is what puts it right.
    await assessReadiness(SITE_ID, { at: AT });
    expect(state.rows[0]).toMatchObject({ ready: false, unready_reason: "outsized" });
    expect(await rankOpen(SITE_ID)).toEqual([]);
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
    await assessReadiness(SITE_ID, { at: AT });
    expect((await supplyDepth(SITE_ID)).unused).toBe(0);
  });

  it("that zero is `outsized` — neither a used-up market nor an unmeasured one", async () => {
    state.rows = [...OUTSIZED_SIX];
    expect(await supplyState(SITE_ID)).toBe("outsized");
  });

  it("a qualifying target is counted as before, and the state falls back to the measured arms", async () => {
    state.rows = [...OUTSIZED_SIX, row({ id: "opp-winnable", volume: 40, fit_band: "winnable" })];
    await assessReadiness(SITE_ID, { at: AT });
    expect((await supplyDepth(SITE_ID)).unused).toBe(1);

    state.rows = [];
    expect(await supplyState(SITE_ID)).not.toBe("outsized");
  });
});

describe("a band given under an older policy is corrected by the next pass (issue 884)", () => {
  // The dogfood's six were banded on 2026-09-17, before right-sizing
  // shipped: stored `winnable`, and outsized under the law as it now
  // stands. Nothing here calls a vendor — every input is a stored number.
  // Built per case: the store mutates the row it is given, exactly as an
  // `update` would, so a shared literal would carry one case's correction
  // into the next.
  const stale = () => row({ id: "stale", target_query: "best seo software", volume: 1000, fit_band: "winnable" });

  it("the demand ceiling re-reads a stored volume against the site's footprint", async () => {
    state.rows = [stale()];
    await assessReadiness(SITE_ID, { at: AT });

    expect(state.rows[0]).toMatchObject({ fit_band: "not-yet", ready: false, unready_reason: "outsized" });
    expect(await rankOpen(SITE_ID)).toEqual([]);
  });

  it("a row inside the ceiling keeps the band it was given", async () => {
    state.rows = [row({ id: "fine", target_query: "seo brief software", volume: 90, fit_band: "winnable" })];
    await assessReadiness(SITE_ID, { at: AT });

    expect(state.rows[0]).toMatchObject({ fit_band: "winnable", ready: true, unready_reason: null });
  });

  it("the re-band is a floor: it can find a row outsized, never restore one", () => {
    const outsized = { ...readRow(stale()), fitBand: "not-yet" as const };
    expect(rebandFor(outsized, 30_000)).toBe("not-yet");
  });

  it("a site with no measured footprint leaves every stored band alone", async () => {
    state.report = null;
    state.rows = [stale()];
    await assessReadiness(SITE_ID, { at: AT });

    expect(state.rows[0]).toMatchObject({ fit_band: "winnable" });
  });
});
