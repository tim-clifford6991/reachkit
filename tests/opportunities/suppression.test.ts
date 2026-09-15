// SPEC §6, issue 477 — a Monday "not working" slows its cluster down: new
// Write in it is held back for `CLUSTER_SUPPRESS_WEEKS`, Improve of a live
// URL in it stays allowed, and an owned URL whose Improve failed twice is
// retired.
import "./env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLUSTER_SUPPRESS_WEEKS } from "../../src/lib/config/constants";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { suppressionOf, type NotWorkingVerdict } from "../../src/lib/opportunities/suppression";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID } from "./fixtures";

const OWNED = "https://example.com/onboarding-guide";
const JUDGED = "2026-09-07";
/** The Monday after the verdict, and the first Monday past its window. */
const NEXT_WEEK = new Date("2026-09-14T06:00:00.000Z");
const PAST_WINDOW = new Date(Date.parse(`${JUDGED}T00:00:00.000Z`) + CLUSTER_SUPPRESS_WEEKS * 7 * 86_400_000);

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

describe("a cluster judged not working", () => {
  it("holds back new Write in that cluster, and the row says why; Improve of a live URL there stays allowed", async () => {
    state.rows.push(
      row({ id: "write-own", family: "write", type: "answer_page", target_ref: "onboarding-faq" }),
      row({ id: "write-other", family: "write", type: "answer_page", target_ref: "pricing-faq", cluster_key: "pricing" }),
      row({ id: "improve-own", family: "improve", type: "expand_page", target_ref: OWNED })
    );
    state.notWorking = [notWorking()];

    await assessReadiness(SITE_ID, { at: NEXT_WEEK });

    expect(state.rows.map((r) => [r.id, r.unready_reason])).toEqual([
      ["write-own", "cluster_suppressed"],
      ["write-other", null],
      ["improve-own", null],
    ]);
    const ranked = (await rankOpen(SITE_ID)).map((r) => r.opportunityId);
    expect(ranked).not.toContain("write-own");
    expect(ranked).toEqual(expect.arrayContaining(["write-other", "improve-own"]));
  });

  it("lasts CLUSTER_SUPPRESS_WEEKS from the Monday it was judged, then releases the row", async () => {
    expect(suppressionOf([notWorking()], new Date(PAST_WINDOW.getTime() - 1)).clusters.has("onboarding")).toBe(true);
    expect(suppressionOf([notWorking()], PAST_WINDOW).clusters.size).toBe(0);

    state.rows.push(row({ id: "write-own", family: "write", type: "answer_page", target_ref: "onboarding-faq" }));
    state.notWorking = [notWorking()];
    await assessReadiness(SITE_ID, { at: NEXT_WEEK });
    expect(state.rows[0]!.unready_reason).toBe("cluster_suppressed");

    await assessReadiness(SITE_ID, { at: PAST_WINDOW });
    expect(state.rows[0]!.unready_reason).toBeNull();
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["write-own"]);
  });

  it("a verdict on a page with no cluster behind it suppresses nothing", () => {
    expect(suppressionOf([notWorking({ clusterKey: null })], NEXT_WEEK).clusters.size).toBe(0);
  });
});

describe("an owned URL whose Improve was judged not working twice", () => {
  const improve = (week: string) => notWorking({ week, family: "improve", targetRef: OWNED });

  it("is retired after the second week, whatever the window, and no open row targets it", async () => {
    expect(suppressionOf([improve(JUDGED)], NEXT_WEEK).retiredUrls.size).toBe(0);
    // One week judged twice is one verdict, not two.
    expect(suppressionOf([improve(JUDGED), improve(JUDGED)], NEXT_WEEK).retiredUrls.size).toBe(0);

    state.rows.push(
      row({ id: "improve-own", family: "improve", type: "refresh_page", target_ref: `${OWNED}/`, cluster_key: "pricing" }),
      row({ id: "improve-other", family: "improve", type: "refresh_page", target_ref: "https://example.com/pricing", cluster_key: "pricing" })
    );
    state.notWorking = [improve("2026-06-01"), improve("2026-06-08")];

    await assessReadiness(SITE_ID, { at: NEXT_WEEK });
    expect(state.rows.map((r) => [r.id, r.unready_reason])).toEqual([
      ["improve-own", "url_retired"],
      ["improve-other", null],
    ]);
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["improve-other"]);
  });
});
