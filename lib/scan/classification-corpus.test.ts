import { describe, expect, it } from "vitest";
import { classifyFootprint, computeCategoryDemand } from "./search-visibility";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import xcom from "./fixtures/classification-corpus/x.com.json";
import resend from "./fixtures/classification-corpus/resend.com.json";
import savvycal from "./fixtures/classification-corpus/savvycal.com.json";
import spacex from "./fixtures/classification-corpus/spacex.com.json";

// ---------------------------------------------------------------------------
// CALIBRATION RATCHET — runs the REAL classifier (classifyFootprint, the same
// path production uses) over REAL captured footprints and asserts the brand /
// category / off-topic split is honest. This is the guard that was missing: G1–G7
// check arithmetic/aliasing on synthetic inputs and never ran the classifier on a
// realistic multi-hundred-keyword footprint — so SpaceX (2-seed demand) and x.com
// ("google" as the "biggest opportunity", brand 0%) shipped. A new misleading
// result → add its domain here with the correct expected split; expectations only
// tighten, never weaken (the ratchet). Fixtures in ./fixtures/classification-corpus/.
// ---------------------------------------------------------------------------

// The captured fixtures omit the per-keyword ranking `url` (classification never
// reads it — only keyword/position/volume/etv), so the corpus rows are a subset.
type CorpusKw = { keyword: string; position: number; volume: number; etv: number };
interface Corpus {
  domain: string;
  note?: string;
  seedText: string[];
  llmCategorySeeds: string[];
  rankedKeywords: CorpusKw[];
}

/** Run the real classification + opportunity computation over a corpus fixture. */
function run(fx: Corpus) {
  const sv = classifyFootprint(fx.domain, fx.seedText, fx.llmCategorySeeds, fx.rankedKeywords as unknown as RankedKeyword[]);
  const rankByKeyword = new Map<string, number>();
  for (const k of fx.rankedKeywords) {
    const key = k.keyword.toLowerCase();
    const cur = rankByKeyword.get(key);
    if (cur === undefined || k.position < cur) rankByKeyword.set(key, k.position);
  }
  // Opportunities are computed from the classified real footprint (no seed volumes
  // needed here — the point is which classified terms surface as "the opportunity").
  const { categoryOpportunities } = computeCategoryDemand([], rankByKeyword, sv.categoryRanked);
  const category = new Set(sv.categoryRanked.map((r) => r.keyword.toLowerCase()));
  return { sv, categoryOpportunities, category };
}

/** Ubiquitous other-brands / entities a mid-market subject ranks for only
 *  incidentally — must NEVER be classified as the subject's own category. */
const MEGA_BRANDS = [
  "google", "youtube", "facebook", "yahoo", "reddit", "twitch", "onlyfans", "espn", "cnn",
  "fox news", "foxnews", "usps", "irs", "costco", "starbucks", "subway", "dominos", "walmart",
];

describe("corpus: x.com — a giant whose footprint is ~entirely other mega-brands", () => {
  const { category, categoryOpportunities } = run(xcom as Corpus);
  it("no mega-brand is classified as x.com's category", () => {
    for (const b of MEGA_BRANDS) expect(category.has(b), `"${b}" must NOT be x.com category`).toBe(false);
  });
  it("the biggest 'opportunity' is not a mega-brand (no 'google is your opportunity')", () => {
    const top = categoryOpportunities[0]?.keyword ?? "";
    expect(MEGA_BRANDS).not.toContain(top);
  });
});

describe("corpus: savvycal.com — footprint is ~all incidental timezone lookups", () => {
  const { sv, category, categoryOpportunities } = run(savvycal as Corpus);
  it("'what time is it in <place>' timezone queries are NOT the category", () => {
    for (const k of category) expect(/\btime\b|hawaii|tokyo|vegas|korea|dubai|california|chicago|london/.test(k), `"${k}" must not be savvycal category`).toBe(false);
  });
  it("category share is not dominated by the timezone noise", () => {
    expect(sv.categoryPct).toBeLessThan(40);
  });
  it("the biggest opportunity is not a timezone lookup", () => {
    expect(/\btime\b|hawaii|tokyo/.test(categoryOpportunities[0]?.keyword ?? "")).toBe(false);
  });
});

describe("corpus: resend.com — the clean SaaS control (must stay right)", () => {
  const { sv, category } = run(resend as Corpus);
  it("brand 'resend' is detected (brandPct > 0)", () => {
    expect(sv.brandPct).toBeGreaterThan(0);
  });
  it("real category terms are category", () => {
    const anyEmail = [...category].some((k) => k === "email api" || k === "send emails");
    expect(anyEmail, `category had: ${[...category].join(", ")}`).toBe(true);
  });
  it("a competitor + off-topic tech are NOT category", () => {
    expect(category.has("sendgrid")).toBe(false);
    expect(category.has("next js")).toBe(false);
    expect(category.has("meaning resent")).toBe(false);
  });
});

describe("corpus: spacex.com — real-category giant (must stay right)", () => {
  const { sv, category } = run(spacex as Corpus);
  it("brand 'spacex' is detected (brandPct > 0)", () => {
    expect(sv.brandPct).toBeGreaterThan(0);
  });
  it("real space/rocket terms are category", () => {
    expect(category.has("space")).toBe(true);
    expect(category.has("rocket launch")).toBe(true);
  });
});
