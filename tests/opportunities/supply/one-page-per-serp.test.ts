// SPEC §6 (one URL per question; the SEO master's C2 of 2026-10-19): the
// questions one stored results page showed are one page, never one each,
// and a live page is never changed by the fold. 0¢: the results page is
// austinplumbery.com's stored "water heater repair" SERP.
import "../env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { marketSetOf } from "../../../src/lib/market/questions/market-set";
import type { Profile } from "../../../src/lib/market/questions/profile";
import { measured } from "../../../src/lib/measure/measured";
import { deriveForPass } from "../../../src/lib/opportunities/pass";
import { setOpportunityStore, type OpportunityRow } from "../../../src/lib/opportunities/store";
import { fakeCost } from "../cost";
import { toolUseMessage } from "../../llm/fixtures";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { AT, SITE_ID, question, reportOf, search, serp } from "../fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { FIT_CALL_SITE } = await import("../../../src/lib/opportunities/derive/fit");

const PROFILE: Profile = {
  category: "plumbing services",
  offeringType: "plumbing repair",
  job: "fix a leak, a blocked drain or a water heater",
  vocabulary: ["plumber", "plumbing", "drain", "water heater", "leak", "repair"],
  brandTokens: ["austin plumbery"],
  audienceTerms: [],
  namedRivals: [],
  kind: "local-service",
  town: "Austin",
};

const MARKET: MarketConclusion = {
  buyer: "",
  job: "",
  category: "residential plumbing",
  synonyms: ["plumber", "emergency plumber", "drain cleaning"],
  differentiators: [],
  notOurMarket: [],
  categoryReason: "",
  rivals: [],
  kind: "local-service",
  serves: { name: "Austin", region: "Texas" },
};

const TERM = "water heater repair";

/** What the stored SERP for `TERM` showed beside it. */
function storedSerp(): { peopleAlsoAsk: string[]; relatedSearches: string[] } {
  const evidence: { source: string; cache_key: string; payload: { peopleAlsoAsk?: string[]; relatedSearches?: string[] }[] }[] = JSON.parse(
    readFileSync("scripts/panel/evidence/austinplumbery.com.json", "utf8")
  );
  const row = evidence.find((one) => one.source === "serp/google/organic" && one.cache_key.split("|")[0] === TERM)!;
  return { peopleAlsoAsk: row.payload[0]!.peopleAlsoAsk ?? [], relatedSearches: row.payload[0]!.relatedSearches ?? [] };
}

const report = () =>
  reportOf(
    { questions: [question({ text: "Emergency plumber in Austin?", search: search({ keyword: "emergency plumber austin" }) })], serps: [serp()] },
    { market: measured(marketSetOf({ profile: PROFILE, suggestions: [] }), AT) }
  );

const fromTerm = (row: OpportunityRow) => (row.evidence as { askedBeside?: { term: string } }).askedBeside?.term === TERM;

let state: MemoryState;

beforeEach(() => {
  // The pass's one fit judgement keeps every search below the top fit, so
  // nothing here is a write target but what buyers were seen asking.
  createMock.mockReset();
  createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
    const input = JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] };
    if (request.tools?.[0]?.name !== FIT_CALL_SITE || input.searches === undefined) throw new Error("no model for this call");
    const scores = input.searches.map(({ i, search }) => ({ i, fit: 2, title: `The angle for ${search}` }));
    return toolUseMessage({ scores, strongest: [] }, 900, 300, FIT_CALL_SITE);
  });
  state = newMemoryState({ profile: PROFILE, market: MARKET, now: AT });
  const { peopleAlsoAsk, relatedSearches } = storedSerp();
  state.asked = [{ term: TERM, peopleAlsoAsk, related: relatedSearches, at: AT }];
  setOpportunityStore(memoryStore(state));
});

afterEach(() => setOpportunityStore(null));

describe("one page per distinct results page", () => {
  it("the questions one stored SERP showed are one row that absorbs the others", async () => {
    await deriveForPass(fakeCost().ctx, { tier: "weekly", siteId: SITE_ID, report: report(), hasActiveAccess: true });

    const rows = state.rows.filter(fromTerm);
    // Twelve questions on one results page are one row, never twelve.
    expect(rows.map((row) => row.target_query)).toEqual(["what is the average cost to repair a water heater"]);
    expect([...rows[0]!.absorbed_queries].sort()).toEqual([
      "electric water heater repair",
      "gas water heater repair",
      "how much does it cost to service a water heater",
      "is it worth it to repair a hot water heater",
      "water heater repair cost",
      "water heater repair kit",
      "water heater repair near california",
      "water heater repair near me",
      "water heater repair near texas",
      "water heater repair reddit",
      "what is the most common problem with a hot water heater",
    ]);
  });

  it("a live page on that results page is untouched, and no second page is written beside it", async () => {
    const live = {
      id: "live",
      site_id: SITE_ID,
      scan_id: "earlier",
      target_ref: "water-heater-repair",
      proposed_slug: null,
      title: null,
      type: "keyword_page",
      family: "write",
      target_query: TERM,
      volume: 1000,
      evidence: { family: "write", volume: { kind: "measured", value: 1000, at: AT.toISOString() } },
      acceptance: { form: "top20", query: TERM },
      fit_band: "winnable",
      effort: 0.3,
      status: "done",
      business_fit: 3,
      cluster_key: null,
      absorbed_queries: [],
      ready: true,
      unready_reason: null,
      created_at: AT.toISOString(),
    } as unknown as OpportunityRow;
    state.rows.push(live);

    await deriveForPass(fakeCost().ctx, { tier: "weekly", siteId: SITE_ID, report: report(), hasActiveAccess: true });

    expect(state.rows.filter(fromTerm)).toEqual([]);
    const after = state.rows.find((row) => row.id === "live")!;
    expect({ status: after.status, cluster_key: after.cluster_key, absorbed_queries: after.absorbed_queries }).toEqual({
      status: "done",
      cluster_key: null,
      absorbed_queries: [],
    });
  });
});
