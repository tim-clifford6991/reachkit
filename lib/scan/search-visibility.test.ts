/**
 * search-visibility.test.ts — the free-tier honest gap metric. Validated against
 * trustmrr.com's REAL ranked-keyword footprint (a startup-revenue directory), the
 * adversarial case: clean site, tiny category, ~90% other-brand visibility.
 */
import { describe, it, expect } from "vitest";
import { computeSearchVisibility, buildVocab } from "./search-visibility";
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
    expect(v).toMatchObject({ score: 0, keywordsRanked: 0, categoryGap: [], offTopicExamples: [] });
  });
});
