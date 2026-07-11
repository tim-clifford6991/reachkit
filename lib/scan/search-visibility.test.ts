/**
 * search-visibility.test.ts — the free-tier honest gap metric. Validated against
 * trustmrr.com's REAL ranked-keyword footprint (a startup-revenue directory), the
 * adversarial case: clean site, tiny category, ~90% other-brand visibility.
 */
import { describe, it, expect } from "vitest";
import { computeSearchVisibility, buildVocab, computeCategoryDemand, buildCategorySeeds } from "./search-visibility";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import type { KeywordIdea } from "@/lib/scan/adapters/dataforseo-keyword-ideas";

const kw = (keyword: string, position: number, volume: number, etv: number): RankedKeyword => ({
  keyword, position, volume, etv, url: "https://trustmrr.com/x",
});

// A representative slice of trustmrr.com's live ranked keywords.
const TRUSTMRR: RankedKeyword[] = [
  // off-topic — other companies' names (the bulk of the footprint)
  kw("spanglish translator", 66, 550000, 1155), kw("cometly", 8, 60500, 1901.8),
  kw("trimrx", 20, 40500, 133.6), kw("shipfast", 13, 720, 8.1), kw("marc lou", 11, 590, 8.9),
  kw("mealslash", 5, 5400, 253.3),
  // brand
  kw("trustmrr", 1, 1600, 486.4), kw("trust mrr", 1, 480, 145.9),
  // category — real topic terms (it ranks well, but tiny volume)
  kw("startup mrr", 2, 90, 27.4), kw("mrr app", 1, 70, 21.3),
  kw("mrr saas", 2, 50, 15.2), kw("startup revenue", 2, 30, 9.1),
];

const VOCAB = buildVocab("trustmrr.com", [
  "verified startup revenue database acquisition marketplace saas mrr",
]);

describe("buildVocab", () => {
  it("treats the domain label as brand and the topic words as category vocab", () => {
    expect(VOCAB.brandTokens.has("trustmrr")).toBe(true);
    expect(VOCAB.categoryVocab.has("startup")).toBe(true);
    expect(VOCAB.categoryVocab.has("mrr")).toBe(true);
    expect(VOCAB.categoryVocab.has("trustmrr")).toBe(false); // brand excluded from category
  });
});

describe("computeSearchVisibility (trustmrr — the aggregator case)", () => {
  const v = computeSearchVisibility(TRUSTMRR, VOCAB);

  it("scores LOW — clean site, but almost no real category search won at volume", () => {
    expect(v.score).toBeLessThan(20);
  });

  it("surfaces that most visibility is OTHER companies' brands (off-topic dominates)", () => {
    expect(v.offTopicPct).toBeGreaterThan(70);
    expect(v.categoryPct).toBeLessThan(15);
    expect(v.offTopicExamples).toContain("cometly");
    expect(v.offTopicExamples).not.toContain("startup mrr");
  });

  it("classifies the domain's own name as brand, its topic terms as category", () => {
    expect(v.keywordsRanked).toBe(12);
    // it WINS its tiny category terms (top 3), so the category gap is empty here
    expect(v.categoryWins).toBeGreaterThan(0);
  });

  it("reports a real footprint (keywords + est. visits)", () => {
    expect(v.keywordsRanked).toBeGreaterThan(0);
    expect(v.estMonthlyVisits).toBeGreaterThan(0);
  });
});

describe("computeSearchVisibility — a healthy category presence scores higher", () => {
  it("a site winning several sizable category terms scores well above the aggregator", () => {
    const vocab = buildVocab("acme.com", ["project management task tracker team software"]);
    const healthy: RankedKeyword[] = [
      kw("project management tool", 2, 12000, 900),
      kw("task tracker", 3, 8000, 600),
      kw("team project software", 4, 5000, 300),
      kw("acme", 1, 2000, 800),
    ];
    const v = computeSearchVisibility(healthy, vocab);
    expect(v.score).toBeGreaterThan(40);
    expect(v.categoryPct).toBeGreaterThan(30);
  });

  it("empty input → zeroed result", () => {
    const v = computeSearchVisibility([], VOCAB);
    expect(v).toMatchObject({ score: 0, keywordsRanked: 0, categoryGap: [], offTopicExamples: [], categoryDemand: 0 });
  });
});

describe("computeCategoryDemand (category size + your share)", () => {
  const idea = (keyword: string, volume: number): KeywordIdea => ({ keyword, volume, intent: null });
  const vocab = buildVocab("acme.com", ["startup revenue mrr saas verification"]);

  it("sums on-topic demand, computes capture rate, and lists opportunities you don't win", () => {
    const ideas = [
      idea("startup revenue tools", 5000), // category, not won → opportunity
      idea("mrr verification", 3000), // category, not won → opportunity
      idea("startup mrr", 1000), // category, WON below → excluded from opportunities
      idea("cometly pricing", 40000), // off-topic → excluded from demand entirely
    ];
    const sv = computeSearchVisibility(
      [{ keyword: "startup mrr", position: 2, volume: 1000, etv: 300, url: "u" }],
      vocab,
    );
    const d = computeCategoryDemand(ideas, vocab, sv);
    // demand = only the on-topic ideas (cometly excluded): 5000+3000+1000
    expect(d.categoryDemand).toBe(9000);
    // off-topic huge term never inflates category demand
    expect(d.categoryDemand).toBeLessThan(40000);
    // opportunities exclude the term you already win ("startup mrr")
    expect(d.categoryOpportunities.map((o) => o.keyword)).toEqual(["startup revenue tools", "mrr verification"]);
    expect(d.categoryCaptureRate).toBeGreaterThanOrEqual(0);
    expect(d.categoryCaptureRate).toBeLessThanOrEqual(100);
  });

  it("zero-rankings site still gets a real category-demand number (capture 0%)", () => {
    const ideas = [idea("startup revenue tools", 8000), idea("mrr saas", 2000)];
    const sv = computeSearchVisibility([], vocab); // ranks for nothing
    const d = computeCategoryDemand(ideas, vocab, sv);
    expect(d.categoryDemand).toBe(10000);
    expect(d.categoryCaptureRate).toBe(0); // captures none of it
    expect(d.categoryOpportunities.length).toBeGreaterThan(0);
  });
});

describe("buildCategorySeeds — LLM seeds are authoritative", () => {
  it("prefers the LLM's clean category phrases over the subject's own rankings", () => {
    const sv = computeSearchVisibility(
      [{ keyword: "startup mrr", position: 2, volume: 90, etv: 27, url: "u" }],
      buildVocab("acme.com", ["startup mrr revenue"]),
    );
    const seeds = buildCategorySeeds(sv, ["buy saas business", "startups for sale"]);
    expect(seeds).toEqual(["buy saas business", "startups for sale"]);
  });

  it("falls back to the subject's category rankings when the LLM gave none", () => {
    const sv = computeSearchVisibility(
      [{ keyword: "startup mrr", position: 2, volume: 90, etv: 27, url: "u" }],
      buildVocab("acme.com", ["startup mrr revenue"]),
    );
    const seeds = buildCategorySeeds(sv, []);
    expect(seeds).toContain("startup mrr");
  });

  it("drops single broad tokens that would broaden keyword_ideas into noise", () => {
    const sv = computeSearchVisibility([], buildVocab("acme.com", ["revenue"]));
    // "saas" (4 chars, single word) is dropped; "buy saas tools" (phrase) kept.
    expect(buildCategorySeeds(sv, ["saas", "buy saas tools"])).toEqual(["buy saas tools"]);
  });
});
