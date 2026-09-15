// Issue 478 — the Earn family inside SPEC §6's cluster collapse and readiness
// (owner, 2026-09-15; the shared code is issue 474's).
//
// An Earn row clusters with the Write and Improve rows on its topic, so the
// collapse keeps one of them — Improve over Earn over Write — and readiness
// refuses an Earn row the site's own pages cannot ground, with the reason
// stored on the row.
import "./env";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { measured } from "../../src/lib/measure/measured";
import { collapse } from "../../src/lib/opportunities/cluster";
import type { Candidate } from "../../src/lib/opportunities/derive/candidate";
import { assessReadiness } from "../../src/lib/opportunities/readiness";
import { rankOpen } from "../../src/lib/opportunities/rank/open";
import { setOpportunityStore, type OpportunityRow } from "../../src/lib/opportunities/store";
import { supplyDepth } from "../../src/lib/opportunities/supply/depth";
import type { Evidence, Opportunity } from "../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { AT, PROFILE, SITE_ID } from "./fixtures";

const BRANDS = ["acme", "appcues"];
const QUERY = "onboarding checklist";

function earnEvidence(query: string): Evidence {
  return {
    family: "earn",
    query,
    volume: measured(100, AT),
    source: { surface: "ai_answer", ref: "g2.com" },
    rival: { domain: "rival.example" },
    asset: "original_data_page",
  };
}

function candidate(over: Partial<Candidate> & Pick<Candidate, "type" | "family" | "targetQuery">): Candidate {
  return {
    siteId: SITE_ID,
    scanId: "scan",
    targetRef: over.targetQuery ?? "ref",
    title: null,
    volume: measured(100, AT),
    evidence: over.family === "earn" ? earnEvidence(over.targetQuery ?? "") : ({ family: over.family } as Evidence),
    acceptance: { form: "top20", query: over.targetQuery ?? "" },
    fitBand: "winnable",
    effort: 0.3,
    ...over,
  };
}

function held(over: Partial<Opportunity> & Pick<Opportunity, "id" | "type" | "family" | "targetQuery">): Opportunity {
  return {
    ...candidate(over),
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: false,
    unreadyReason: "not_assessed",
    createdAt: AT,
    ...over,
  } as Opportunity;
}

describe("an Earn row clusters with the Write and Improve rows on its topic", () => {
  it("an Earn candidate outranks a held Write on the same topic: the Write is dismissed and its search absorbed", () => {
    const plan = collapse({
      existing: [held({ id: "w1", type: "keyword_page", family: "write", targetQuery: QUERY })],
      candidates: [candidate({ type: "listed_page", family: "earn", targetQuery: "onboarding checklists" })],
      brandTokens: BRANDS,
    });
    expect(plan.dismiss).toEqual(["w1"]);
    expect(plan.insert.map((c) => [c.type, c.clusterKey, c.absorbedQueries])).toEqual([
      ["listed_page", "checklist onboarding", [QUERY]],
    ]);
  });

  it("an Improve of an owned URL outranks the Earn candidate, which folds into it", () => {
    const plan = collapse({
      existing: [],
      candidates: [
        candidate({ type: "listed_page", family: "earn", targetQuery: QUERY, volume: measured(9000, AT) }),
        candidate({ type: "expand_page", family: "improve", targetQuery: "checklist for onboarding", targetRef: "https://example.com/guide" }),
      ],
      brandTokens: BRANDS,
    });
    expect(plan.insert.map((c) => [c.family, c.absorbedQueries])).toEqual([["improve", [QUERY]]]);
  });

  it("a held Earn row re-derived on the next pass moves nothing", () => {
    const plan = collapse({
      existing: [held({ id: "e1", type: "listed_page", family: "earn", targetQuery: QUERY, clusterKey: "checklist onboarding" })],
      candidates: [candidate({ type: "listed_page", family: "earn", targetQuery: QUERY })],
      brandTokens: BRANDS,
    });
    expect(plan).toEqual({ dismiss: [], update: [], insert: [] });
  });
});

describe("readiness refuses an Earn row the site's own pages cannot ground, and stores why", () => {
  let state: MemoryState;
  let n = 0;
  const row = (over: Partial<OpportunityRow> & Pick<OpportunityRow, "family" | "type" | "target_query">): OpportunityRow => {
    n += 1;
    const evidence =
      over.family === "earn"
        ? { ...earnEvidence(over.target_query ?? ""), volume: { kind: "measured", value: 500, at: AT.toISOString() } }
        : { family: over.family, volume: { kind: "measured", value: 500, at: AT.toISOString() } };
    return {
      id: `r${n}`, site_id: SITE_ID, scan_id: "scan", target_ref: `ref-${n}`, proposed_slug: null, title: null,
      volume: 500, evidence, acceptance: { form: "named_on", question: over.target_query }, fit_band: "winnable",
      effort: 0.3, status: "open", cluster_key: null, absorbed_queries: [], ready: false,
      unready_reason: "not_assessed", created_at: AT.toISOString(),
      ...over,
    };
  };

  beforeEach(() => {
    state = newMemoryState({ profile: PROFILE });
    setOpportunityStore(memoryStore(state));
  });
  afterEach(() => setOpportunityStore(null));

  it("a grounded Earn row is ready, and ranks after Improve and before Write", async () => {
    state.rows.push(
      row({ id: "write", family: "write", type: "answer_page", target_query: "what is a product tour", volume: 9000 }),
      row({ id: "earn", family: "earn", type: "listed_page", target_query: "user onboarding benchmarks" }),
      row({ id: "improve", family: "improve", type: "expand_page", target_query: "user onboarding checklist", volume: 20 })
    );
    await assessReadiness(SITE_ID, { at: AT });
    const earn = state.rows.find((r) => r.id === "earn");
    expect([earn?.ready, earn?.unready_reason]).toEqual([true, null]);
    expect((await rankOpen(SITE_ID)).map((r) => r.opportunityId)).toEqual(["improve", "earn", "write"]);
  });

  it("with no grounding fact the Earn row stores no_grounding_fact and fills no day", async () => {
    state.grounded = false;
    state.rows.push(row({ id: "earn", family: "earn", type: "listed_page", target_query: "user onboarding benchmarks" }));
    await assessReadiness(SITE_ID, { at: AT });
    expect([state.rows[0]?.ready, state.rows[0]?.unready_reason]).toEqual([false, "no_grounding_fact"]);
    expect(await rankOpen(SITE_ID)).toEqual([]);
    expect((await supplyDepth(SITE_ID)).unused).toBe(0);
  });
});
