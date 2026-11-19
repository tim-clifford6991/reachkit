// SPEC §6, issue 477 — an owned URL whose Improve was judged not working twice is retired.
import "./env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { suppressionOf, type NotWorkingVerdict } from "../../src/lib/opportunities/suppression";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID } from "./fixtures";

const OWNED = "https://example.com/onboarding-guide";
const JUDGED = "2026-09-07";
/** The Monday after the verdict. */
const NEXT_WEEK = new Date("2026-09-14T06:00:00.000Z");

let n = 0;
function row(over: Partial<OpportunityRow> & Pick<OpportunityRow, "family" | "type" | "target_ref">): OpportunityRow {
  n += 1;
  return {
    id: `opp-${n}`,
    site_id: SITE_ID,
    scan_id: "scan",
    target_query: "user onboarding software",
    proposed_slug: over.family === "write" ? over.target_ref : null,
    title: null,
    volume: 500,
    evidence: { family: over.family, volume: { kind: "measured", value: 500, at: AT.toISOString() } },
    acceptance: { form: "top20", query: "user onboarding software" },
    fit_band: "winnable",
    effort: 0.3,
    status: "open",
    cluster_key: "onboarding",
    absorbed_queries: [],
    ready: false,
    unready_reason: "not_assessed",
    created_at: AT.toISOString(),
    ...over,
  };
}

const notWorking = (over: Partial<NotWorkingVerdict> = {}): NotWorkingVerdict => ({
  week: JUDGED,
  clusterKey: "onboarding",
  family: "write",
  targetRef: "onboarding-checklist",
  ...over,
});

let state: MemoryState;
beforeEach(() => {
  state = newMemoryState({ profile: PROFILE });
  setOpportunityStore(memoryStore(state));
});
afterEach(() => setOpportunityStore(null));

describe("an owned URL whose Improve was judged not working twice", () => {
  const improve = (week: string) => notWorking({ week, family: "improve", targetRef: OWNED });

  it("is retired after the second week, and no open row targets it", async () => {
    expect(suppressionOf([improve(JUDGED)]).retiredUrls.size).toBe(0);
    // One week judged twice is one verdict, not two.
    expect(suppressionOf([improve(JUDGED), improve(JUDGED)]).retiredUrls.size).toBe(0);

    state.rows.push(
      row({ id: "improve-own", family: "improve", type: "refresh_page", target_ref: `${OWNED}/`, cluster_key: "pricing" }),
      row({ id: "improve-other", family: "improve", type: "refresh_page", target_ref: "https://example.com/pricing", cluster_key: "pricing" })
    );
    state.notWorking = [improve("2026-06-01"), improve("2026-06-08")];

    await assessReadiness(SITE_ID, { at: NEXT_WEEK });
    expect(state.rows.map((r) => [r.id, r.unready_reason])).toEqual([
      ["improve-own", "resting"],
      ["improve-other", null],
    ]);
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["improve-other"]);
  });
});

it("a closed footprint lets each planned date's week take one comparison: none beside 17 Nov's, one the next week", async () => {
  const compare = (id: string) => row({ id, family: "write", type: "comparison_page", target_ref: id, business_fit: 3 });
  Object.assign(state, { weeklyCommit: "2026-11-23", drafted: [{ date: "2026-11-17", state: "drafted", title: null, row: compare("drafted") }], rows: [compare("c-1")] });
  const readyFor = async (plannedFrom: string) => (await assessReadiness(SITE_ID, { at: new Date("2026-11-18T22:00:00Z"), plannedFrom }), state.rows[0]!.ready);
  expect([await readyFor("2026-11-19"), await readyFor("2026-11-24")]).toEqual([false, true]);
});
