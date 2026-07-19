import { describe, expect, it } from "vitest";
import { classifyFootprint, computeCategoryDemand } from "./search-visibility";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import xcom from "./fixtures/classification-corpus/x.com.json";
import xcomLegitimizedNews from "./fixtures/classification-corpus/x.com.legitimized-news.json";
import resend from "./fixtures/classification-corpus/resend.com.json";
import savvycal from "./fixtures/classification-corpus/savvycal.com.json";
import savvycalLegitimizedTime from "./fixtures/classification-corpus/savvycal.com.legitimized-time.json";
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
// Fixture `seedText` must be the subject's REAL captured prose — an incomplete
// seedText ships false OFF-TOPIC flips for the subject's own sub-brands (the
// react-email lesson, 2026-07-19: the hand-authored resend.com fixture omitted
// the site's own prose about "React Email", so "react-email" wrongly foreclosed
// to off-topic for want of vocab support that the real page actually provides).
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

describe("corpus: x.com (legitimized-news seeds) — the 'fox news' class, reproducing live scan aae8a31d", () => {
  // Today's live inputs: the lite synth's marketTiers prompt emitted "real-time
  // news feed" as a category seed, which corroborates the generic token "news"
  // into x.com's category vocabulary. Before the bigram-join fix, that legitimized
  // "news" let the multi-word keyword "fox news" ride into "category" (its tokens
  // ["fox","news"] never match the stored concatenated entry "foxnews"). The class
  // fix must hold even with "news" legitimized, and must NOT demote x.com's real,
  // legitimately-named categories ("microblogging platform", "social media network").
  const { category, categoryOpportunities } = run(xcomLegitimizedNews as Corpus);
  it("no mega-brand — including the multi-word 'fox news' — is classified as x.com's category", () => {
    for (const b of MEGA_BRANDS) expect(category.has(b), `"${b}" must NOT be x.com category`).toBe(false);
  });
  it("the biggest 'opportunity' is not a mega-brand (no 'fox news is your opportunity')", () => {
    const top = categoryOpportunities[0]?.keyword ?? "";
    expect(MEGA_BRANDS).not.toContain(top);
  });
  it("x.com's real, legitimately-named categories stay category", () => {
    expect(category.has("microblogging platform"), `category had: ${[...category].join(", ")}`).toBe(true);
    expect(category.has("social media network"), `category had: ${[...category].join(", ")}`).toBe(true);
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

describe("corpus: savvycal.com (legitimized-time seeds) — the macro rule's OWN mechanism, reproducing the 'fox news' class generically", () => {
  // The plain savvycal.com.json fixture above passes even under the OLD
  // any-shared-token rule, because "time" is never corroborated there (the
  // pollutant filter alone blocks it). This variant legitimizes "time" via an
  // LLM category seed ("real-time availability") — same mechanism that let
  // "news" ride "fox news" into category — so ONLY the macro rule (every
  // non-generic token must be supported; "hawaii"/"tokyo"/"japan"/etc. never
  // are) keeps every timezone lookup off-topic. Part A2 (2026-07-19).
  const { category, categoryOpportunities } = run(savvycalLegitimizedTime as Corpus);
  it("'time' is genuinely corroborated (the real category term IS category)", () => {
    expect(category.has("real-time availability calendar"), `category had: ${[...category].join(", ")}`).toBe(true);
  });
  it("every timezone lookup stays off-topic even with 'time' legitimized — the unsupported geo token forecloses category", () => {
    for (const k of category) {
      expect(/hawaii|tokyo|japan|korea|vegas|chicago|dubai|california|england|usa/.test(k), `"${k}" must not be savvycal category`).toBe(false);
    }
  });
  it("the biggest opportunity is not a timezone lookup", () => {
    expect(/hawaii|tokyo|japan/.test(categoryOpportunities[0]?.keyword ?? "")).toBe(false);
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
  // React Email is Resend's OWN flagship sub-product (its own page's prose says
  // so — "seamlessly integrates with React Email", "loving the development
  // experience of React Email"), so the keyword "react-email" (tokens
  // ["react","email"]) must classify as Resend's category, not off-topic. This
  // was the INVERSE of the usual bug class: not a false CATEGORY (a mega-brand/
  // generic token riding in), but a false OFF-TOPIC — the hand-authored fixture
  // seedText omitted the site's own captured prose about its sub-brand, so
  // "react" had zero vocab support and the macro rule (every non-generic token
  // must be supported) correctly-per-its-rule but WRONGLY-per-reality forecloses
  // category. Fixed by making seedText capture-accurate, not by special-casing
  // the classifier.
  it("'react-email' (Resend's own sub-product) classifies as category, not off-topic", () => {
    expect(category.has("react-email"), `category had: ${[...category].join(", ")}`).toBe(true);
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
