import { describe, expect, it } from "vitest";
import { classifyFootprint, computeCategoryDemand } from "./search-visibility";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";
import xcom from "./fixtures/classification-corpus/x.com.json";
import xcomLegitimizedNews from "./fixtures/classification-corpus/x.com.legitimized-news.json";
import xcomSubjectBrandTwitter from "./fixtures/classification-corpus/x.com.subject-brand-twitter.json";
import resend from "./fixtures/classification-corpus/resend.com.json";
import savvycal from "./fixtures/classification-corpus/savvycal.com.json";
import savvycalLegitimizedTime from "./fixtures/classification-corpus/savvycal.com.legitimized-time.json";
import spacex from "./fixtures/classification-corpus/spacex.com.json";
// D3 (2026-07-20, data board P1): the two DIRECTORY controls — real captures
// whose footprint IS the AGGREGATED dimension (see each fixture's own note).
import trustmrr from "./fixtures/classification-corpus/trustmrr.com.json";
import getapp from "./fixtures/classification-corpus/getapp.com.json";
// P1 review fix (2026-07-20): the missing reachkit ≈0-aggregation control
// (REAL data — reachkit.app genuinely has zero rankings, verified via Supabase
// MCP; see the fixture's own note) + the blog/docs false-positive class
// (CONSTRUCTED, clearly labeled — see the fixture's own note).
import reachkit from "./fixtures/classification-corpus/reachkit.app.json";
import blogHeavySaas from "./fixtures/classification-corpus/blog-heavy-saas.constructed.json";

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

// D3 (2026-07-20, data board P1): `url` is now OPTIONAL on the corpus row type
// — the URL-template batch pass (computeSearchVisibility's AGGREGATED-dimension
// detection) reads it, so fixtures that exercise that pass carry real per-row
// URLs (trustmrr, getapp, and the non-directory controls below, all pulled
// from the live search_cache `rk:<domain>:50` bodies, Supabase MCP project
// kleepxxddbcnfsfwudoe, 2026-07-20). Fixtures that predate this field simply
// omit it — `run()` below defaults a missing url to "", which never forms a
// 2-segment path template (see `pathContainer`), so their aggregated split
// stays exactly 0, identical to their pre-P1 behaviour.
type CorpusKw = { keyword: string; position: number; volume: number; etv: number; url?: string };
interface Corpus {
  domain: string;
  note?: string;
  seedText: string[];
  llmCategorySeeds: string[];
  rankedKeywords: CorpusKw[];
  /** PR-5 (2026-07-19): the subject's REAL captured name(s) — `facts.listing.name`
   *  — threaded through classifyFootprint's OWN signature (no side channel), so
   *  this corpus exercises EXACTLY the production path. Optional: most fixtures'
   *  domain label is already a usable brand token; only x.com needs it, and even
   *  then only in an honest "post-Part-C shape" variant (see x.com.subject-brand-
   *  twitter.json) — x.com's REAL captured title today is literal garbage
   *  ("x.com"), so the plain x.com fixtures gain no brandNames. */
  brandNames?: string[];
}

/** Run the real classification + opportunity computation over a corpus fixture. */
function run(fx: Corpus) {
  // url ?? "" — see the CorpusKw doc comment above (pre-P1 fixtures omit it).
  const rowsWithUrl = fx.rankedKeywords.map((k) => ({ ...k, url: k.url ?? "" }));
  const sv = classifyFootprint(fx.domain, fx.seedText, fx.llmCategorySeeds, rowsWithUrl as unknown as RankedKeyword[], fx.brandNames ?? []);
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
  const { sv, category, categoryOpportunities } = run(xcom as Corpus);
  it("no mega-brand is classified as x.com's category", () => {
    for (const b of MEGA_BRANDS) expect(category.has(b), `"${b}" must NOT be x.com category`).toBe(false);
  });
  it("the biggest 'opportunity' is not a mega-brand (no 'google is your opportunity')", () => {
    const top = categoryOpportunities[0]?.keyword ?? "";
    expect(MEGA_BRANDS).not.toContain(top);
  });
  // D3 (2026-07-20, data board P1): x.com is NOT a directory — its incidental
  // mega-brand hits (google/foxnews/espn/…) must stay off-topic NOISE, never
  // AGGREGATED. Real per-row URLs (x.com.json) are single-segment profile
  // pages (x.com/FoxNews) with no repeated 2+-segment container, so the
  // URL-template pass correctly finds nothing here.
  it("aggregatedPct stays ~0 — a big platform's incidental mega-brand hits are NOT a directory listing", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
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
  const { sv, category, categoryOpportunities } = run(xcomLegitimizedNews as Corpus);
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
  it("aggregatedPct stays ~0 here too — legitimizing 'news' doesn't create a directory", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
  });
});

describe("corpus: x.com POST-PART-C shape (subject brand name recovered) — PR-5 the brand≠domain class", () => {
  // Live evidence (2026-07-19): x.com scans read "your brand 0% / other
  // companies' names 100%" — brand tokens derive ONLY from the domain
  // ("x.com" -> unusable "x"), so the real brand ("twitter") is unrecognised
  // AND sits in MEGA_BRAND_TOKENS, so x.com's own brand queries counted as
  // "other companies' names". This fixture simulates the shape once Part C
  // (a separate, not-yet-built fix) recovers the real page title/name and
  // threads it through as `brandNames` — proving THIS fix (the brand
  // vocabulary + mega-brand exemption) is correct on an honest input, while
  // x.com's own fixtures (no usable real title yet) stay unchanged.
  const { sv, category, categoryOpportunities } = run(xcomSubjectBrandTwitter as Corpus);

  it("'twitter' queries classify BRAND, not 'other companies' names' (brandPct > 0)", () => {
    expect(sv.brandPct).toBeGreaterThan(0);
  });

  it("'twitter' itself is never a category ranking or the 'biggest opportunity' (it's the subject's OWN brand)", () => {
    expect(category.has("twitter")).toBe(false);
    const top = categoryOpportunities[0]?.keyword ?? "";
    expect(top).not.toBe("twitter");
  });

  it("every OTHER mega-brand still classifies off-topic — the exemption applies ONLY to the subject's own brand token", () => {
    for (const b of MEGA_BRANDS) expect(category.has(b), `"${b}" must NOT be x.com category`).toBe(false);
  });

  it("aggregatedPct stays ~0 — recovering the real brand doesn't turn x.com into a directory", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
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
  // D3 (2026-07-20, data board P1): savvycal is NOT a directory — its
  // timezone-lookup footprint is one page per place, ranking under many
  // keyword PHRASINGS of the SAME lookup (same URL, same slug every time),
  // never a repeated container with distinct entity slugs.
  it("aggregatedPct stays ~0 — repeated phrasings of the SAME timezone page are not a directory of entities", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
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
  const { sv, category, categoryOpportunities } = run(savvycalLegitimizedTime as Corpus);
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
  // Task-G (2026-07-20, VERIFIED live prod evidence): the 2-char geo-abbreviation
  // class. "time in hi" tokenizes (under the OLD 3-char floor) to JUST ["time"] —
  // "in" is filler, "hi" is silently dropped for being 2 chars — so the macro
  // rule's "every non-generic token supported" was satisfied VACUOUSLY by the
  // single surviving corroborated-generic token "time", and a Hawaii-timezone
  // lookup rode into savvycal's category (246k of its 257k live "category
  // demand"). A real scheduling term ("real-time availability calendar") must
  // still classify category — the fix must not over-drop.
  it("'time in hi' — the 2-char geo-abbreviation collapse — is OFF-TOPIC, not category (live evidence 2026-07-20)", () => {
    expect(category.has("time in hi"), `category had: ${[...category].join(", ")}`).toBe(false);
  });
  it("a real scheduling term still classifies category (the fix does not over-drop)", () => {
    expect(category.has("real-time availability calendar"), `category had: ${[...category].join(", ")}`).toBe(true);
  });
  it("aggregatedPct stays ~0 here too", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
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
  it("aggregatedPct stays ~0 — resend is not a directory", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
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
  // D3 (2026-07-20, data board P1): SpaceX's own two products (dragon,
  // starship) share the URL container "vehicles" but that's only 2 DISTINCT
  // slugs — well under N_TEMPLATE(4). A company's own product line must NOT
  // be mistaken for "a directory of vehicles" and reclassified aggregated.
  it("aggregatedPct stays ~0 — dragon/starship's shared 'vehicles' URL container is 2 products, not a directory of third-party entities", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
  });
});

// D3 (2026-07-20, data board P1): the two DIRECTORY controls. Corpus-first —
// these expectations were written and watched FAIL before the URL-template
// pass existed (aggregatedPct read 0 for both; see task-P1-report.md for the
// recorded before/after).
describe("corpus: trustmrr.com — the directory whose footprint IS the AGGREGATED dimension", () => {
  const { sv } = run(trustmrr as Corpus);

  it("aggregatedPct is HIGH — most of the footprint is the startups it lists, not off-topic noise", () => {
    expect(sv.aggregatedPct).toBeGreaterThan(60);
  });

  it("residual offTopicPct (genuine noise) is small — only the 1-row 'founder'/'special-category' pages remain", () => {
    expect(sv.offTopicPct).toBeLessThan(15);
  });

  it("aggregatedExamples names real listed startups (cometly), not the lone founder profile", () => {
    expect(sv.aggregatedExamples).toContain("cometly");
    expect(sv.aggregatedExamples).not.toContain("marc lou");
  });

  it("brand 'trustmrr' and its tiny real category terms are UNTOUCHED by the split", () => {
    expect(sv.brandPct).toBeGreaterThan(0);
    expect(sv.categoryPct).toBeGreaterThan(0);
  });
});

describe("corpus: getapp.com — the second directory control, a DIFFERENT URL shape (category-then-'a'-then-slug)", () => {
  const { sv } = run(getapp as Corpus);

  it("aggregatedPct is HIGH — the container is the constant 'a' segment, not the (per-row-varying) category segment ahead of it", () => {
    expect(sv.aggregatedPct).toBeGreaterThan(60);
  });

  it("residual offTopicPct is low", () => {
    expect(sv.offTopicPct).toBeLessThan(15);
  });

  it("aggregatedExamples names real listed software (amcs, a real getapp listing)", () => {
    expect(sv.aggregatedExamples.length).toBeGreaterThan(0);
  });
});

// P1 review fix (2026-07-20): the reachkit ≈0-aggregation control the plan
// named twice but no fixture existed for (see the fixture's own note for the
// Supabase MCP verification that this is reachkit.app's REAL current state —
// pre-launch, genuinely zero rankings — not a placeholder).
describe("corpus: reachkit.app — the real ≈0 control (pre-launch, genuinely zero rankings)", () => {
  const { sv } = run(reachkit as Corpus);

  it("aggregatedPct is 0 — no rankings means no directory listings to detect", () => {
    expect(sv.aggregatedPct).toBe(0);
  });

  it("normal brand/category expectations for a zero-ranking site: everything honestly zero, nothing fabricated", () => {
    expect(sv.brandPct).toBe(0);
    expect(sv.categoryPct).toBe(0);
    expect(sv.keywordsRanked).toBe(0);
    expect(sv.categoryRanked).toEqual([]);
  });
});

// P1 review fix (2026-07-20, the blog/docs false-positive class): a normal
// SaaS's own /blog/<slug> section structurally matches the URL-template
// signal exactly like a real directory (>=N_TEMPLATE distinct-slug rows on
// the SAME container) — live-verified by review to wrongly reclassify
// off-topic blog-post titles as "directory listings". This fixture is
// CONSTRUCTED (not a real capture — see its own note) specifically to prove
// the entity-shape requirement keeps topic-shaped headlines in the residual
// off-topic bucket even when the URL-template signal alone would have fired.
describe("corpus: flowdeskapp.com (CONSTRUCTED) — a normal SaaS's own /blog section must NOT become 'aggregated'", () => {
  const { sv } = run(blogHeavySaas as Corpus);

  it("aggregatedPct stays ≈0 — the blog posts are topic phrases, not third-party entity listings", () => {
    expect(sv.aggregatedPct).toBeLessThan(5);
  });

  it("the blog posts stay in the residual off-topic bucket instead (that's where 5 unrelated topic posts belong)", () => {
    expect(sv.offTopicPct).toBeGreaterThan(60);
  });

  it("no blog post title is ever named as an 'aggregated' (directory-listing) example", () => {
    expect(sv.aggregatedExamples).toEqual([]);
  });

  it("the site's real brand + category rows are untouched by the fix (still classify normally)", () => {
    expect(sv.brandPct).toBeGreaterThan(0);
    expect(sv.categoryPct).toBeGreaterThan(0);
  });
});
