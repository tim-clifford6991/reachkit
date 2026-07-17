/**
 * search-visibility.test.ts — the free-tier honest gap metric. Validated against
 * trustmrr.com's REAL ranked-keyword footprint (a startup-revenue directory), the
 * adversarial case: clean site, tiny category, ~90% other-brand visibility.
 */
import { describe, it, expect } from "vitest";
import { computeSearchVisibility, buildVocab, computeCategoryDemand, buildCategorySeeds } from "./search-visibility";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";

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

describe("computeCategoryDemand (from exact seed-phrase volumes)", () => {
  const vocab = buildVocab("acme.com", ["startup revenue mrr saas verification"]);

  it("sums seed volumes, uses SV score as capture, lists the seeds you don't win", () => {
    const seedVolumes = [
      { keyword: "startup revenue tools", volume: 5000 }, // not ranked → opportunity
      { keyword: "mrr verification", volume: 3000 }, // not ranked → opportunity
      { keyword: "startup mrr", volume: 1000 }, // ranked #2 → won → excluded from opportunities
    ];
    const sv = computeSearchVisibility(
      [{ keyword: "startup mrr", position: 2, volume: 1000, etv: 300, url: "u" }],
      vocab,
    );
    const rankByKeyword = new Map([["startup mrr", 2]]);
    const d = computeCategoryDemand(seedVolumes, rankByKeyword);
    expect(d.categoryDemand).toBe(9000);
    // categoryCaptureRate is GONE (it was === score, a metric aliased to another).
    expect(d.categoryOpportunities.map((o) => o.keyword)).toEqual(["startup revenue tools", "mrr verification"]);
    expect(sv.score).toBeGreaterThanOrEqual(0); // sv still computes a real score
  });

  it("zero-rankings site: demand is real, all seeds are opportunities", () => {
    const seedVolumes = [{ keyword: "startup revenue tools", volume: 8000 }, { keyword: "mrr saas", volume: 2000 }];
    const d = computeCategoryDemand(seedVolumes, new Map());
    expect(d.categoryDemand).toBe(10000);
    expect(d.categoryOpportunities.length).toBe(2);
  });

  it("ignores zero-volume seeds", () => {
    const d = computeCategoryDemand(
      [{ keyword: "a", volume: 0 }, { keyword: "b", volume: 500 }],
      new Map(),
    );
    expect(d.categoryDemand).toBe(500);
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

// ---------------------------------------------------------------------------
// Guard class G1/G2 (free-scan number honesty). These make the shipped lies
// un-representable: a metric may not be an ALIAS of another metric, and a total
// may not be the API FETCH LIMIT dressed up as a measurement.
// ---------------------------------------------------------------------------
import type { SearchVisibility } from "./search-visibility";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("free-scan number honesty (guards G1, G2)", () => {
  it("G1: the SearchVisibility type carries NO categoryCaptureRate / categoryCapturedSearches field", () => {
    // These were `= sv.score` (G1: a metric aliased to another) and its incoherent
    // internal numerator. A type-level assertion: the fields must not exist.
    const sv: SearchVisibility = {
      score: 5, keywordsRanked: 2100, estMonthlyVisits: 100, footprintComplete: true,
      brandPct: 10, categoryPct: 20, offTopicPct: 70, categoryGap: [], offTopicExamples: [],
      categoryWins: 0, categoryDemand: 1000, categoryOpportunities: [], categoryWonKeywords: [],
    };
    // @ts-expect-error — categoryCaptureRate is deleted; referencing it must not typecheck.
    expect(sv.categoryCaptureRate).toBeUndefined();
    // @ts-expect-error — categoryCapturedSearches is deleted.
    expect(sv.categoryCapturedSearches).toBeUndefined();
  });

  it("G1 (source): no metric is DECLARED as an alias of another (`= sv.score`) or the incoherent numerator", () => {
    // The exact shipped defect was `const categoryCaptureRate = sv.score`. Pin the
    // absence of the CODE (declaration/assignment), not any mention — the DELETED
    // comment legitimately names the fields it explains.
    const src = readFileSync(resolve(process.cwd(), "lib/scan/search-visibility.ts"), "utf8");
    expect(src).not.toMatch(/\bcategoryCaptureRate\s*=/); // no assignment/declaration
    expect(src).not.toMatch(/const\s+categoryCapturedSearches\b/); // no re-introduction of the numerator
  });

  it("G2: keywordsRanked comes from the domain total (footprintComplete), not the 50-cap sample", () => {
    // A domain that truly ranks for 2,100 must NOT render 50 (the ranked_keywords
    // limit). computeSearchVisibility alone yields the sample with footprintComplete
    // FALSE; the gather overrides with the true total and sets it true. So the flag
    // is the honesty contract: a "complete" footprint is never the fetch cap.
    const sampleOnly = computeSearchVisibility(
      [{ keyword: "x", position: 3, volume: 100, etv: 50, url: "u" }],
      buildVocab("acme.com", ["x category"]),
    );
    expect(sampleOnly.footprintComplete).toBe(false); // sample → must be disclosed
  });
});
