// SPEC §6 (issue 1519, the SEO master review of 2026-10-18, B2): the "People
// also ask" questions and related searches on the site's stored SERPs are
// informational topics, at 0¢.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCost } from "../cost";
import { toolUseMessage } from "../../llm/fixtures";
import { measured, unmeasured } from "../../../src/lib/measure/measured";
import type { MarketConclusion } from "../../../src/lib/market/infer/types";
import { contentTypeOf } from "../../../src/lib/opportunities/content-type";
import { pageTypeOf } from "../../../src/lib/opportunities/page-type";
import { setOpportunityStore } from "../../../src/lib/opportunities/store";
import { eligible, type ReadinessContext } from "../../../src/lib/opportunities/readiness";
import type { Opportunity } from "../../../src/lib/opportunities/types";
import { memoryStore, newMemoryState, type MemoryState } from "../memory-store";
import { AT, PROFILE, SCAN_ID, SITE_ID, question, reportOf, serp, smallCounts } from "../fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

const { deriveOpportunities } = await import("../../../src/lib/opportunities/derive");
const { FIT_CALL_SITE } = await import("../../../src/lib/opportunities/derive/fit");
const { BUYER_SEARCHES_CALL_SITE, TYPED_CALL_SITE } = await import("../../../src/lib/opportunities/derive/buyer-searches");
const { askedTopics, proposedTopics } = await import("../../../src/lib/opportunities/derive/topics");

const MARKET: MarketConclusion = {
  buyer: "SaaS product teams",
  job: "Get new users to their first success",
  category: "user onboarding software",
  synonyms: ["product tour software"],
  differentiators: [],
  notOurMarket: ["employee onboarding"],
  categoryReason: "",
  rivals: [{ domain: "appcues.com", name: "Appcues", basis: "ranks", reason: "", volume: 5400 }],
  demand: { at: "2026-10-05T00:00:00.000Z", own: 880, brands: { appcues: 5400 } },
};

const ASKED = {
  peopleAlsoAsk: [
    "What is user onboarding?",
    "How do I onboard new users to a SaaS product?",
    "Why do users churn after signing up?",
    "Appcues meaning?",
    "How do you onboard a new employee?",
  ],
  relatedSearches: ["user onboarding checklist", "employee onboarding software", "best user onboarding software"],
};

const report = () => reportOf({ questions: [question()], serps: [serp(ASKED)] });

/** The pass's searches keep fit 3 for at most a quarter of them (issue 1134),
 *  so the pass's own SERP here shows as many questions as that allows. */
const PASS_ASKED = {
  peopleAlsoAsk: ["What is user onboarding?", "Why do users churn after signing up?", "Appcues meaning?"],
  relatedSearches: ["user onboarding checklist", "employee onboarding software", "best user onboarding software"],
};

let state: MemoryState;

beforeEach(() => {
  createMock.mockReset();
  state = newMemoryState();
  setOpportunityStore(memoryStore(state));
});

afterEach(() => setOpportunityStore(null));

/** A question buyers were seen asking at fit 3, every other search at 2, and
 *  a buyer types none of the pass's own words. */
function judgeAskedTopFit(): string[] {
  const typedAsked: string[] = [];
  createMock.mockImplementation(async (request: { messages: { content: string }[]; tools?: { name: string }[] }) => {
    const input = JSON.parse(request.messages[0]!.content) as { searches?: { i: number; search: string }[] };
    const site = request.tools?.[0]?.name;
    if (site === BUYER_SEARCHES_CALL_SITE) return toolUseMessage({ problems: [], solutions: [] }, 300, 100, BUYER_SEARCHES_CALL_SITE);
    if (site === TYPED_CALL_SITE) {
      typedAsked.push(...(input.searches ?? []).map(({ search }) => search));
      return toolUseMessage({ typed: [] }, 300, 50, TYPED_CALL_SITE);
    }
    if (site !== FIT_CALL_SITE || input.searches === undefined) throw new Error("no model for this call");
    const askedHere = new Set(["user onboarding checklist", "what is user onboarding", "why do users churn after signing up"]);
    const scores = input.searches.map(({ i, search }) => ({ i, fit: askedHere.has(search) ? 3 : 2, title: `The angle for ${search}` }));
    return toolUseMessage({ scores, strongest: scores.filter((score) => score.fit === 3).map((score) => score.i) }, 900, 300, FIT_CALL_SITE);
  });
  return typedAsked;
}

describe("a question buyers were seen asking becomes a Write candidate (condition 1)", () => {
  it("each on-market question and related search on the SERP is a section of the page for the search it was seen beside", async () => {
    const typedAsked = judgeAskedTopFit();
    const { ctx } = fakeCost();
    const passReport = reportOf({ questions: [question()], serps: [serp(PASS_ASKED)] });
    await deriveOpportunities(ctx, { siteId: SITE_ID, scanId: SCAN_ID, report: passReport, ownRanked: measured(0, AT), rankedCounts: smallCounts(), market: MARKET });

    // One results page is one page: its questions have no volume or top ten
    // of their own, so they fold into the page for the search they were seen beside.
    expect(state.rows.map((row) => row.target_query)).toEqual(["best user onboarding software"]);
    // Not "employee onboarding software" (not this market), "appcues
    // meaning" (a rival's name as a word) or the SERP's own search.
    expect([...state.rows[0]!.absorbed_queries].sort()).toEqual([
      "user onboarding checklist",
      "what is user onboarding",
      "why do users churn after signing up",
    ]);
    // Google showed them, so the "would a buyer type this?" check never reads them.
    expect(typedAsked.filter((search) => state.rows[0]!.absorbed_queries.includes(search))).toEqual([]);
  });

  it("never a search of another market, a rival's name asked about as a word, or the SERP's own search", () => {
    const topics = askedTopics([{ term: "best user onboarding software", peopleAlsoAsk: ASKED.peopleAlsoAsk, related: ASKED.relatedSearches, at: AT }], AT);
    const proposed = proposedTopics({ report: report(), market: MARKET, taken: [], ownRanked: 0, max: 80, asked: topics });
    const queries = proposed.filter((topic) => topic.asked !== undefined).map((topic) => topic.query);
    expect(queries).not.toContain("employee onboarding software");
    expect(queries).not.toContain("appcues meaning");
    expect(queries).not.toContain("best user onboarding software");
    expect(queries).toContain("what is user onboarding");
  });

  it("a SERP older than 30 days says nothing, and no one SERP fills the list", () => {
    const old = new Date(AT.getTime() - 31 * 86_400_000);
    expect(askedTopics([{ term: "a", peopleAlsoAsk: ["What is a?"], related: [], at: old }], AT)).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => `What is thing ${i}?`);
    const topics = askedTopics([
      { term: "a", peopleAlsoAsk: many, related: [], at: AT },
      { term: "b", peopleAlsoAsk: ["What is b?"], related: [], at: AT },
    ], AT);
    expect(topics).toHaveLength(24);
    expect(topics.slice(0, 2).map((topic) => topic.query)).toEqual(["what is thing 0", "what is b"]);
  });

  it("in German, a bakery's question is proposed in its own words", () => {
    const bakery: MarketConclusion = {
      ...MARKET,
      buyer: "Familien in Mainz",
      job: "Frisches Brot kaufen",
      category: "Bäckerei",
      synonyms: [],
      notOurMarket: ["Großhandel"],
      rivals: [],
      demand: undefined,
    };
    const topics = askedTopics([{ term: "bäckerei mainz", peopleAlsoAsk: ["Ist Sauerteigbrot bekömmlicher?", "Was ist ein Sauerteig?"], related: ["sauerteig ansetzen"], at: AT }], AT);
    const proposed = proposedTopics({ report: report(), market: bakery, taken: [], ownRanked: 0, max: 80, asked: topics, language: "de" });
    expect(proposed.filter((topic) => topic.asked !== undefined).map((topic) => topic.query)).toEqual([
      "ist sauerteigbrot bekömmlicher",
      "was ist ein sauerteig",
      "sauerteig ansetzen",
    ]);
  });
});

/** A Write row as the pass stores a question buyers were seen asking. */
function askedRow(query: string, over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: query,
    siteId: SITE_ID,
    scanId: SCAN_ID,
    type: "keyword_page",
    family: "write",
    targetQuery: query,
    targetRef: "ref",
    title: null,
    volume: unmeasured<number>("not_attempted", AT),
    evidence: {
      family: "write",
      query,
      volume: unmeasured<number>("not_attempted", AT),
      rival: { domain: "appcues.com", url: unmeasured<string>("not_attempted", AT), position: unmeasured<number>("not_attempted", AT) },
      askedBeside: { term: "best user onboarding software", serpAt: AT },
    },
    acceptance: { form: "top20", query },
    fitBand: "winnable",
    businessFit: 3,
    source: "problem",
    effort: 0.3,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: false,
    unreadyReason: "not_assessed",
    createdAt: AT,
    ...over,
  };
}

describe("its type follows its words (condition 2)", () => {
  it("a question is a Q&A, a how is a how-to, a what-is is documentation, in English and German, and each is a question answered unless it names a product's alternatives", () => {
    const cases: [string, string][] = [
      ["why do users churn after signing up", "qa"],
      ["how do i onboard new users to a saas product", "how_to"],
      ["what is user onboarding", "documentation"],
      ["ist sauerteigbrot bekömmlicher", "qa"],
      ["wie kann ich sauerteig ansetzen", "how_to"],
      ["was ist ein sauerteig", "documentation"],
    ];
    for (const [query, type] of cases) {
      const row = askedRow(query);
      expect(contentTypeOf(row)).toBe(type);
      expect(pageTypeOf(row)).toBe("answer");
    }
    expect(pageTypeOf(askedRow("what are the best appcues alternatives", { source: "product" }))).toBe("product");
  });
});

describe("D60 reads it as observed demand (condition 3)", () => {
  const ctx: ReadinessContext = {
    now: AT,
    grounded: true,
    earnGrounding: { comparison_table: true, integration_page: true, original_data_page: true },
    suppression: { clusters: new Set(), retiredUrls: new Set() },
    profile: PROFILE,
    ownRanks: () => false,
    canUpdate: () => true,
    coveredBy: () => null,
    prompts: [{ id: "p1", text: "Which CRM integrates with Slack?" }],
  };

  it("an unmeasured question matching no tracked prompt is ready where buyers were seen asking it, and no_intent where not", () => {
    const row = askedRow("why do users churn after signing up");
    expect(eligible(row, ctx)).toBeNull();
    const plain = { ...(row.evidence as Extract<Opportunity["evidence"], { family: "write" }>), askedBeside: undefined };
    expect(eligible({ ...row, evidence: plain }, ctx)).toBe("no_intent");
    // The rest of readiness still applies: a topic the site already covers is held.
    const covered = { ...ctx, coveredBy: () => ({ url: "https://example.com/churn", title: "Churn", score: 1 }) as never };
    expect(eligible(row, covered)).toBe("destination_cannot_address");
  });
});
