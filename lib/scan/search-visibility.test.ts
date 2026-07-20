/**
 * search-visibility.test.ts — the free-tier honest gap metric. Validated against
 * trustmrr.com's REAL ranked-keyword footprint (a startup-revenue directory), the
 * adversarial case: clean site, tiny category, ~90% other-brand visibility.
 */
import { describe, it, expect, vi } from "vitest";
import type { RankedKeyword } from "@/lib/scan/adapters/dataforseo-ranked-keywords";

// Mocked ONLY for the invariant-#1 gather-level test below (every other test in
// this file exercises pure functions and never touches the network/cache
// layer). Spied so a single test can control the 3 calls `gatherFreeSearchVisibility`
// makes without hitting DataForSEO.
const gatherRankedSpy = vi.fn(async (..._a: unknown[]) => [] as RankedKeyword[]);
const gatherOverviewSpy = vi.fn(async (..._a: unknown[]) => null as null);
const gatherVolumesSpy = vi.fn(async (..._a: unknown[]) => [] as Array<{ keyword: string; volume: number }>);
vi.mock("@/lib/scan/cache/cached-adapters", () => ({
  cachedRankedKeywords: (...a: unknown[]) => gatherRankedSpy(...a),
  cachedDomainOverview: (...a: unknown[]) => gatherOverviewSpy(...a),
  cachedKeywordVolumes: (...a: unknown[]) => gatherVolumesSpy(...a),
}));

import {
  computeSearchVisibility, buildVocab, computeCategoryDemand, buildCategorySeeds, computeMarketTiers,
  classifyFootprint, gatherFreeSearchVisibility, stem, computeCategoryLadder, ladderCandidates, CATEGORY_FLOOR,
  essentialLadderCandidates,
} from "./search-visibility";
import { tokens, GENERIC_TOKENS } from "@/lib/scan/referral/brand-keywords";
import type { CategoryNicheSeeds } from "@/lib/llm/types";

// Default url is a single-segment placeholder ("/x") — deliberately NEVER a
// 2+-segment URL template match (see `pathContainer` in search-visibility.ts),
// so every EXISTING test in this file that doesn't care about the D3
// aggregated-dimension split keeps its pre-P1 behaviour unchanged unless it
// opts in with a real per-row url (5th arg).
const kw = (keyword: string, position: number, volume: number, etv: number, url = "https://trustmrr.com/x"): RankedKeyword => ({
  keyword, position, volume, etv, url,
});

// A representative slice of trustmrr.com's live ranked keywords, url-less
// (placeholder path) — used by tests that predate/are indifferent to the D3
// aggregated split. `TRUSTMRR_REAL_URLS` below is the SAME keyword set with
// its REAL per-entity URLs (verified live capture, search_cache
// `rk:trustmrr.com:50`, 2026-07-11) for the D3-specific tests.
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

// D3 (2026-07-20, data board P1): the SAME 12 rows, but with their REAL
// trustmrr.com ranking-page URLs (verified live capture, search_cache
// `rk:trustmrr.com:50`, 2026-07-11 — trustmrr's own directory pattern is
// `/startup/<slug>`; "shipfast" isn't in that specific 50-row capture, so its
// URL is CONSTRUCTED in the same real, verified pattern and documented as
// such here, not a live-captured row). Brand + category terms rank on the
// homepage ("/", single segment — never a template match); the off-topic
// entity names rank on individual `/startup/<slug>` listing pages.
const TRUSTMRR_REAL_URLS: RankedKeyword[] = [
  kw("spanglish translator", 66, 550000, 1155, "https://trustmrr.com/startup/spanglishtranslator-app"),
  kw("cometly", 8, 60500, 1901.8, "https://trustmrr.com/startup/cometly"),
  kw("trimrx", 20, 40500, 133.6, "https://trustmrr.com/startup/trimrx"),
  // CONSTRUCTED (not in the live-captured 50-row sample) — same real /startup/<slug> pattern.
  kw("shipfast", 13, 720, 8.1, "https://trustmrr.com/startup/shipfast"),
  // Only 1 row under "founder" (below N_TEMPLATE) — stays residual noise, not aggregated.
  kw("marc lou", 11, 590, 8.9, "https://trustmrr.com/founder/marclou"),
  kw("mealslash", 5, 5400, 253.3, "https://trustmrr.com/startup/mealslash-llc"),
  kw("trustmrr", 1, 1600, 486.4, "https://trustmrr.com/"),
  kw("trust mrr", 1, 480, 145.9, "https://trustmrr.com/"),
  kw("startup mrr", 2, 90, 27.4, "https://trustmrr.com/"),
  kw("mrr app", 1, 70, 21.3, "https://trustmrr.com/"),
  kw("mrr saas", 2, 50, 15.2, "https://trustmrr.com/"),
  kw("startup revenue", 2, 30, 9.1, "https://trustmrr.com/"),
];

const VOCAB = buildVocab("trustmrr.com", [
  "verified startup revenue database acquisition marketplace saas mrr",
]);

describe("stem — the STOPWORDS footgun guard", () => {
  it("never strips 'news' down to the stopword 'new' — keeps the original token", () => {
    expect(stem("news")).toBe("news");
  });
});

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

// D3 (2026-07-20, data board P1): with REAL per-entity URLs present, the old
// "off-topic dominates" framing above is what D3 REPLACES — most of
// trustmrr's "off-topic" traffic is not noise, it's THIRD-PARTY ENTITY
// listings (the startups it directories). This is the corpus-first
// expectation the brief asked to write FIRST, watch fail (pre-implementation
// it would have read aggregatedPct === 0, offTopicPct > 70 — the OLD
// numbers), then implement against.
describe("computeSearchVisibility (trustmrr — D3 AGGREGATED dimension, real URLs)", () => {
  const v = computeSearchVisibility(TRUSTMRR_REAL_URLS, VOCAB);

  it("aggregatedPct is HIGH — most of the footprint is directory-listed entity names", () => {
    expect(v.aggregatedPct).toBeGreaterThan(70);
  });

  it("residual offTopicPct (genuine noise) is near 0 — only 'marc lou' (1 founder-profile row) remains", () => {
    expect(v.offTopicPct).toBeLessThan(5);
  });

  it("aggregatedExamples names the listed entities (cometly, not marc lou)", () => {
    expect(v.aggregatedExamples).toContain("cometly");
    expect(v.aggregatedExamples).not.toContain("marc lou"); // below N_TEMPLATE, stays noise
  });

  it("offTopicExamples no longer names directory listings — 'cometly'/'spanglish translator' moved to aggregatedExamples", () => {
    expect(v.offTopicExamples).not.toContain("cometly");
    expect(v.offTopicExamples).not.toContain("spanglish translator");
  });

  it("categoryPct is UNCHANGED from the no-url-data version — the aggregated split never touches category rows (invariant #1)", () => {
    const withoutUrls = computeSearchVisibility(TRUSTMRR, VOCAB);
    expect(v.categoryPct).toBe(withoutUrls.categoryPct);
  });

  it("sv.score is IDENTICAL whether or not URL data (and therefore the aggregated split) is present — the direct invariant #1 proof", () => {
    const withoutUrls = computeSearchVisibility(TRUSTMRR, VOCAB);
    // withoutUrls never detects a template (placeholder single-segment url), so
    // its offtopic bucket never splits — proving the split, when it DOES fire,
    // changes nothing about `score` (score is computed from category rows only,
    // never from offtopic/aggregated).
    expect(withoutUrls.aggregatedPct).toBe(0);
    expect(v.aggregatedPct).toBeGreaterThan(0); // the split DID fire here
    expect(v.score).toBe(withoutUrls.score); // yet the score is identical
  });

  it("brandPct is also unchanged — only offtopic rows are ever reclassified", () => {
    const withoutUrls = computeSearchVisibility(TRUSTMRR, VOCAB);
    expect(v.brandPct).toBe(withoutUrls.brandPct);
  });

  // MUTATION PROOF (brief requirement): disabling the URL-template reclassify
  // must collapse trustmrr's aggregatedPct back to 0 — i.e. this assertion
  // reproduces exactly what `git diff --stat` + a manual revert of the
  // `entityListingTemplates`/`pathContainer` wiring in computeSearchVisibility
  // was verified to do during implementation (see task-P1-report.md for the
  // recorded before/after run). This test pins the NON-mutated (fixed) state
  // so a future regression that silently disables the pass fails here too.
  it("(mutation-proof anchor) aggregatedPct depends on the URL-template pass actually running", () => {
    // Same rows, but url stripped to "" (simulating the pass being disabled /
    // never seeing real URLs) — must behave exactly like the no-url fixture.
    const urlless = computeSearchVisibility(
      TRUSTMRR_REAL_URLS.map((k) => ({ ...k, url: "" })),
      VOCAB,
    );
    expect(urlless.aggregatedPct).toBe(0);
    expect(v.aggregatedPct).toBeGreaterThan(70); // the real, non-mutated behaviour
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

// The scale-invariant demand merge (2026-07-18) — fixes the SpaceX class where
// demand was Σ(2 narrow LLM seeds) = 8,170 while the site actually ranks in a
// category worth hundreds of thousands of searches/mo (it ranks #12 for "space",
// 368k). ONE rule for big + small: the site's REAL category rankings
// (sv.categoryRanked, from the same ranked_keywords call — no new spend) MERGE
// with the seed volumes; real rankings dominate for a big site, seeds fill in /
// cover a 0-ranking new site.
describe("computeCategoryDemand — merges the REAL category footprint (scale-invariant)", () => {
  // A SpaceX-shaped footprint: high-volume category terms it ranks for but hasn't
  // won, plus one it HAS won, plus a brand term and an off-topic term.
  const SPACEX_VOCAB = buildVocab("spacex.com", ["rocket launch space exploration commercial spaceflight starship"]);
  const SPACEX_KW: RankedKeyword[] = [
    kw("space", 12, 368000, 5000),              // category, big near-miss
    kw("space launch system", 10, 110000, 800), // category, near-miss
    kw("rocket launch", 4, 74000, 900),         // category, near-miss (pos 4 > 3)
    kw("starship", 1, 50000, 4000),             // category, WON (pos 1) → not an opportunity
    kw("spacex", 1, 200000, 8000),              // brand
    kw("dragon", 5, 30000, 500),                // off-topic (no vocab token)
  ];

  it("computeSearchVisibility exposes the real category rankings (volume + position), highest-volume first", () => {
    const sv = computeSearchVisibility(SPACEX_KW, SPACEX_VOCAB);
    expect(sv.categoryRanked[0]).toEqual({ keyword: "space", volume: 368000, yourPosition: 12 });
    expect(sv.categoryRanked.map((r) => r.keyword)).toEqual(["space", "space launch system", "rocket launch", "starship"]);
    // Brand + off-topic terms are NOT category rankings.
    expect(sv.categoryRanked.map((r) => r.keyword)).not.toContain("spacex");
    expect(sv.categoryRanked.map((r) => r.keyword)).not.toContain("dragon");
  });

  it("demand + opportunities reflect the REAL footprint, not the 2 narrow seeds (the SpaceX fix)", () => {
    const sv = computeSearchVisibility(SPACEX_KW, SPACEX_VOCAB);
    const rankByKeyword = new Map(SPACEX_KW.map((k) => [k.keyword.toLowerCase(), k.position] as const));
    // The LLM's thin seed — the ONLY category signal in the old design.
    const seedVolumes = [{ keyword: "launch services", volume: 8100 }];
    const d = computeCategoryDemand(seedVolumes, rankByKeyword, sv.categoryRanked);

    // demand is the real category (~610k), NOT the 8,100 seed.
    expect(d.categoryDemand).toBe(368000 + 110000 + 74000 + 50000 + 8100);
    expect(d.categoryDemand).toBeGreaterThan(500000);

    // the biggest opportunity is the real near-miss WITH its position — the discovery.
    expect(d.categoryOpportunities[0]).toEqual({ keyword: "space", volume: 368000, yourPosition: 12 });
    // a WON term (starship, pos 1) is never an opportunity.
    expect(d.categoryOpportunities.map((o) => o.keyword)).not.toContain("starship");
    // the thin seed is dwarfed, not the headline.
    expect(d.categoryOpportunities[0]?.keyword).not.toBe("launch services");

    // G4 still holds: the total is exactly the sum of its named parts.
    expect(d.categoryDemand).toBe(d.categoryPhrases.reduce((s, p) => s + p.volume, 0));
  });

  it("scale-invariance: a 0-ranking site falls back to the seeds (categoryRanked empty)", () => {
    const seedVolumes = [{ keyword: "launch services", volume: 8100 }, { keyword: "commercial space launch", volume: 70 }];
    const d = computeCategoryDemand(seedVolumes, new Map(), []); // no footprint
    expect(d.categoryDemand).toBe(8170); // identical to the seed-only behaviour
    expect(d.categoryOpportunities.map((o) => o.keyword)).toEqual(["launch services", "commercial space launch"]);
    // No rankings → no position on the opportunities.
    expect(d.categoryOpportunities.every((o) => o.yourPosition === undefined)).toBe(true);
  });
});

// Task-G (2026-07-20) — completes the grounding PR-8 applied to the market
// tiers: computeCategoryDemand merged ALL seed volumes with NO grounding at
// all, so an LLM categorySeed priced to a real DataForSEO volume but sharing
// no vocabulary with the subject's REAL category rankings could pollute the
// demand HERO itself. VERIFIED live evidence: trustmrr.com's categoryPhrases
// were [{"business intelligence platform", 165000}, {"startup marketplace",
// 50}, {"startup revenue", 30, #2}] -> categoryDemand 165,080 — trustmrr
// neither ranks for "business intelligence platform" nor is a BI platform.
// Reuses the SAME shared grounding helper PR-8 added for the tiers
// (groundedCategoryTokens / isTierPhraseGrounded, private to this file) — no
// forked grounding logic for a third site.
describe("computeCategoryDemand grounding (task-G, 2026-07-20) — no LLM-guessed seeds in the demand hero (the trustmrr class)", () => {
  const trustmrrCategoryRanked = [
    { keyword: "mrr startup", volume: 90, yourPosition: 2 },
    { keyword: "startup mrr", volume: 90, yourPosition: 2 },
    { keyword: "mrr app", volume: 70, yourPosition: 1 },
    { keyword: "startup revenue", volume: 30, yourPosition: 2 },
  ];
  const emptyRanks = new Map<string, number>();

  it("an ungrounded seed is EXCLUDED from categoryDemand/categoryPhrases even though its volume is real (trustmrr 'business intelligence platform')", () => {
    const seedVolumes = [
      { keyword: "business intelligence platform", volume: 165000 }, // ungrounded — LLM guess, real DataForSEO volume
      { keyword: "startup marketplace", volume: 50 }, // grounded — shares "startup" with categoryRanked
      { keyword: "startup revenue", volume: 30 }, // already a real ranking too
    ];
    const d = computeCategoryDemand(seedVolumes, emptyRanks, trustmrrCategoryRanked);
    expect(d.categoryPhrases.map((p) => p.keyword)).not.toContain("business intelligence platform");
    expect(d.categoryDemand).not.toBe(165080); // the shipped, dishonest total
    // Real rankings (always included) + the one grounded seed.
    expect(d.categoryDemand).toBe(90 + 90 + 70 + 30 + 50);
    // G4 still holds after grounding: total is exactly the sum of its named parts.
    expect(d.categoryDemand).toBe(d.categoryPhrases.reduce((s, p) => s + p.volume, 0));
  });

  it("a seed the subject ranks for EXACTLY is grounded even with zero token overlap", () => {
    const seedVolumes = [{ keyword: "totally unrelated phrase", volume: 500 }];
    const ranks = new Map([["totally unrelated phrase", 5]]);
    const d = computeCategoryDemand(seedVolumes, ranks, trustmrrCategoryRanked);
    expect(d.categoryPhrases.map((p) => p.keyword)).toContain("totally unrelated phrase");
  });

  it("real rankings (categoryRanked) are ALWAYS included regardless of seed grounding — they're real by definition", () => {
    const d = computeCategoryDemand([], emptyRanks, trustmrrCategoryRanked);
    expect(d.categoryDemand).toBe(90 + 90 + 70 + 30);
  });

  it("empty categoryRanked keeps TODAY's seed fallback UNFILTERED (no ranking evidence to ground against — degrade to best-effort, not to nothing)", () => {
    const seedVolumes = [{ keyword: "business intelligence platform", volume: 165000 }];
    const d = computeCategoryDemand(seedVolumes, emptyRanks, []); // no footprint at all
    expect(d.categoryDemand).toBe(165000); // unfiltered — same as today's behaviour
  });

  // Review fix (2026-07-20, Minor finding): the old version of this test called
  // `computeCategoryDemand` and then asserted a PREVIOUSLY-computed, entirely
  // separate `sv.score` was unchanged — but `computeCategoryDemand` doesn't
  // even receive `sv` as an argument, so there was no way for the call to
  // touch it. The assertion was true by construction and could never fail.
  // This version instead drives the REAL production merge path —
  // `gatherFreeSearchVisibility`, which is what actually stitches
  // `computeCategoryDemand`'s output onto the classified `sv` object
  // (`{ ...sv, ...demand, ... }` in `search-visibility.ts`) — and compares its
  // returned score against classifying the identical rows/vocab directly, with
  // no demand/merge involved at all. A regression that let the merge clobber
  // `score` (an errant `score` key on the demand object, the spread order
  // flipped, or a stray direct `sv.score = …` mutation) would make this fail.
  it("invariant #1: the categoryDemand grounding merge (the REAL gather pipeline) never touches sv.score", async () => {
    gatherRankedSpy.mockResolvedValueOnce(TRUSTMRR);
    gatherOverviewSpy.mockResolvedValueOnce(null);
    gatherVolumesSpy.mockResolvedValueOnce([
      { keyword: "business intelligence platform", volume: 165000 }, // ungrounded — must be dropped from demand, must not move score
      { keyword: "startup marketplace", volume: 50 },
      { keyword: "startup revenue", volume: 30 },
    ]);
    const seedText = ["verified startup revenue database acquisition marketplace saas mrr"];
    const llmCategorySeeds = ["business intelligence platform", "startup marketplace", "startup revenue"];

    const gathered = await gatherFreeSearchVisibility("trustmrr.com", seedText, llmCategorySeeds);

    // The grounding actually ran (not a no-op stand-in for the real thing).
    expect(gathered.categoryPhrases.map((p) => p.keyword)).not.toContain("business intelligence platform");

    // …and it did not touch score: classifying the SAME rows/vocab directly —
    // no demand, no merge — produces the identical score the gather returned.
    const expected = classifyFootprint("trustmrr.com", seedText, llmCategorySeeds, TRUSTMRR, []);
    expect(gathered.score).toBe(expected.score);
  });
});

// ---------------------------------------------------------------------------
// computeCategoryLadder (P2, 2026-07-20, data board) — CATEGORY is the broad
// umbrella and must be LARGE (Tim's rule): a grounded category demand below
// CATEGORY_FLOOR is laddered UP by dropping leading/trailing qualifier tokens
// from the LLM's category phrases until a grounded broader form clears the
// floor, never past a term that loses every real/niche token (the guard).
// NICHE stays specific and may be small; every niche phrase must share a
// non-generic token with the category (⊆ by construction).
// ---------------------------------------------------------------------------
describe("computeCategoryLadder — CATEGORY must be LARGE, never fabricated (D2)", () => {
  /** A niche phrase shares a real, non-generic token with SOME category phrase
   *  — the corpus-level ⊆ check, independent of the implementation. */
  function nicheIsContainedInCategory(nichePhrase: string, categoryPhrases: string[]): boolean {
    const nicheToks = new Set(tokens(nichePhrase).map(stem).filter((t) => !GENERIC_TOKENS.has(t)));
    return categoryPhrases.some((c) => tokens(c).map(stem).some((t) => !GENERIC_TOKENS.has(t) && nicheToks.has(t)));
  }

  describe("ladderCandidates — broader forms by dropping leading/trailing qualifier tokens", () => {
    it("enumerates every contiguous window shorter than the original phrase, longest first", () => {
      expect(ladderCandidates("seo analytics tools")).toEqual([
        "seo analytics", "analytics tools", "seo", "analytics", "tools",
      ]);
    });
    it("a single-token phrase has no broader form", () => {
      expect(ladderCandidates("seo")).toEqual([]);
    });
  });

  it("reachkit.app: a tiny grounded SEO category ladders to a LARGE umbrella ('seo')", () => {
    const categoryRanked = [
      { keyword: "seo audit tool", volume: 2400, yourPosition: 15 },
      { keyword: "seo scan", volume: 1300, yourPosition: 22 },
    ];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "SEO tooling", phrases: ["seo audit tool", "website seo checker"] },
      niche: { label: "SEO competitor tracking", phrases: ["seo competitor tracking", "compare seo rivals"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["seo audit tool", 90],
      ["website seo checker", 200],
      ["seo", 40500], // the ladder candidate that clears the floor
      ["seo competitor tracking", 70],
      ["compare seo rivals", 20],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard, nicheCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    // D2, the machine-checked version of Tim's rule: category is LARGE.
    expect(categoryCard.demand).toBeGreaterThanOrEqual(CATEGORY_FLOOR);
    expect(categoryCard.demand).toBe(40500);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["seo"]);
    expect(categoryCard.label).toBe("SEO tooling");
    // Not the tiny unladdered 90+200 = 290.
    expect(categoryCard.demand).not.toBe(290);

    // Niche stays small and honest.
    expect(nicheCard.demand).toBeLessThan(CATEGORY_FLOOR);
    expect(nicheCard.demand).toBe(90); // 70 + 20
    expect(nicheCard.label).toBe("SEO competitor tracking");
    for (const p of nicheCard.phrases) {
      expect(nicheIsContainedInCategory(p.keyword, categoryNiche.category.phrases)).toBe(true);
    }
  });

  it("savvycal.com: scheduling category ladders to a LARGE umbrella ('scheduling')", () => {
    const categoryRanked = [
      { keyword: "appointment scheduling tool", volume: 110, yourPosition: 8 },
      { keyword: "meeting scheduler", volume: 320, yourPosition: 14 },
    ];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Scheduling software", phrases: ["online scheduling tool", "meeting scheduler app"] },
      niche: { label: "Scheduling for consultants", phrases: ["consultant scheduling tool", "client booking calendar"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["online scheduling tool", 110],
      ["meeting scheduler app", 90],
      ["scheduling", 33100], // the ladder candidate that clears the floor
      ["consultant scheduling tool", 40],
      ["client booking calendar", 20],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard, nicheCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    expect(categoryCard.demand).toBeGreaterThanOrEqual(CATEGORY_FLOOR);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["scheduling"]);
    // savvycal ranks for ZERO scheduling terms in this fixture — a real hook (0 top-3).
    expect(categoryCard.rankedTop3).toEqual([]);
    expect(nicheCard.demand).toBeLessThan(CATEGORY_FLOOR);
  });

  it("x.com: social-media category ladders to a huge umbrella ('social')", () => {
    const categoryRanked = [
      { keyword: "social media platform", volume: 9900, yourPosition: 5 },
      { keyword: "microblogging app", volume: 720, yourPosition: 3 },
    ];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Social media", phrases: ["social networking site", "microblogging platform"] },
      niche: { label: "Microblogging for public figures", phrases: ["microblogging service"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["social networking site", 480],
      ["microblogging platform", 90],
      ["social", 673000], // the ladder candidate that clears the floor — "hundreds of thousands"
      ["microblogging service", 320],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard, nicheCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    expect(categoryCard.demand).toBeGreaterThanOrEqual(CATEGORY_FLOOR);
    expect(categoryCard.demand).toBe(673000);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["social"]);
    expect(nicheCard.demand).toBeLessThan(CATEGORY_FLOOR);
    expect(nicheCard.phrases.map((p) => p.keyword)).toContain("microblogging service");
  });

  it("trustmrr.com: the tiny (90/mo) real category ladders to a LARGE grounded umbrella, not left tiny — niche keeps the small real MRR terms", () => {
    // VERIFIED live rankings (task-P2 brief): "startup revenue" #2, "mrr startup" #2.
    const categoryRanked = [
      { keyword: "mrr startup", volume: 90, yourPosition: 2 },
      { keyword: "startup mrr", volume: 90, yourPosition: 2 },
      { keyword: "mrr app", volume: 70, yourPosition: 1 },
      { keyword: "startup revenue", volume: 30, yourPosition: 2 },
    ];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Startup tools", phrases: ["mrr tracking tool", "startup revenue tools"] },
      niche: { label: "MRR verification", phrases: ["mrr verification tool", "startup revenue verification"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["mrr tracking tool", 90],
      ["startup revenue tools", 40],
      ["startup", 40500], // the ladder candidate that clears the floor
      ["mrr verification tool", 20],
      ["startup revenue verification", 10],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard, nicheCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    expect(categoryCard.demand).toBeGreaterThanOrEqual(CATEGORY_FLOOR);
    // Not the tiny unladdered 90+40 = 130 (the shipped-dishonest class this fixes).
    expect(categoryCard.demand).not.toBe(130);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["startup"]);
    // Niche keeps the small real MRR terms — honest, no fabrication.
    expect(nicheCard.demand).toBe(30);
    expect(nicheCard.phrases.map((p) => p.keyword).sort()).toEqual(["mrr verification tool", "startup revenue verification"]);
  });

  it("no ladder needed when the grounded category head phrases already clear the floor", () => {
    const categoryRanked = [{ keyword: "email api", volume: 12000, yourPosition: 4 }];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Email APIs", phrases: ["email api", "transactional email api"] },
      niche: { label: "Email API for developers", phrases: ["email api for developers"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["email api", 9000],
      ["transactional email api", 1500],
      ["email api for developers", 40],
    ]);
    const rankByKeyword = new Map<string, number>([["email api", 2]]);

    const { categoryCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    // Already ≥ floor (9000+1500=10500) — the ORIGINAL multi-phrase list is kept, not collapsed to one term.
    expect(categoryCard.demand).toBe(10500);
    expect(categoryCard.phrases.map((p) => p.keyword).sort()).toEqual(["email api", "transactional email api"]);
    expect(categoryCard.rankedTop3.map((p) => p.keyword)).toEqual(["email api"]);
  });

  it("ladder-over-broaden guard: a huge token-less generic ladder candidate is REJECTED even though its volume clears the floor", () => {
    // "invoice automation widgets" (tiny, 50/mo) would ladder to 1-token "widgets"
    // (999,999/mo) — but "widgets" shares NO token with the real rankings or the
    // niche phrases, so it must be rejected; the algorithm falls back to the
    // next-broadest QUALIFYING candidate, "invoice automation" (still ≥ floor).
    const categoryRanked = [{ keyword: "invoice automation", volume: 200, yourPosition: 5 }];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Invoicing tools", phrases: ["invoice automation widgets"] },
      niche: { label: "Invoice reminders", phrases: ["invoice automation reminders"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["invoice automation widgets", 50],
      ["widgets", 999999], // huge but token-less — must be REJECTED by the guard
      ["invoice automation", 15000], // the correct, guarded pick
      ["invoice automation reminders", 30],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    expect(categoryCard.phrases.map((p) => p.keyword)).not.toContain("widgets");
    expect(categoryCard.demand).not.toBe(999999);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["invoice automation"]);
    expect(categoryCard.demand).toBe(15000);
  });

  it("exhausted ladder (no candidate clears the floor): stays small and honest — a genuine micro-niche is not forced to lie", () => {
    const categoryRanked = [{ keyword: "artisan quill repair", volume: 40, yourPosition: 3 }];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Artisan quill repair", phrases: ["artisan quill repair service"] },
      niche: { label: "Vintage fountain pen quill repair", phrases: ["vintage fountain pen quill repair"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["artisan quill repair service", 40],
      ["artisan quill repair", 60],
      ["quill repair", 90],
      ["artisan quill", 20],
      ["artisan", 30],
      ["quill", 50],
      ["repair", 40], // "repair" is real vocab here but still tiny — genuinely small market
      ["vintage fountain pen quill repair", 10],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, categoryRanked);

    // Nothing clears CATEGORY_FLOOR — degrade to the original small, honest number.
    expect(categoryCard.demand).toBeLessThan(CATEGORY_FLOOR);
    expect(categoryCard.demand).toBe(40);
    expect(categoryCard.phrases.map((p) => p.keyword)).toEqual(["artisan quill repair service"]);
  });

  it("no ranking evidence at all (0-ranking new site): degrades to unfiltered LLM phrases rather than asserting nothing", () => {
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "AI meeting notes", phrases: ["ai meeting notes app"] },
      niche: { label: "AI notes for sales calls", phrases: ["ai sales call notes"] },
    };
    const volumesByKeyword = new Map<string, number>([
      ["ai meeting notes app", 12100],
      ["ai sales call notes", 320],
    ]);
    const rankByKeyword = new Map<string, number>();

    const { categoryCard, nicheCard } = computeCategoryLadder(categoryNiche, volumesByKeyword, rankByKeyword, []);

    expect(categoryCard.demand).toBe(12100);
    expect(nicheCard.demand).toBe(320);
  });

  it("invariant #1: categoryCard/nicheCard are presentation only — never feed sv.score", async () => {
    gatherRankedSpy.mockResolvedValueOnce(TRUSTMRR);
    gatherOverviewSpy.mockResolvedValueOnce(null);
    gatherVolumesSpy.mockResolvedValueOnce([
      { keyword: "mrr tracking tool", volume: 90 },
      { keyword: "mrr", volume: 40500 }, // ladder candidate of "mrr tracking tool"
      { keyword: "mrr verification tool", volume: 20 },
    ]);
    const seedText = ["verified startup revenue database acquisition marketplace saas mrr"];
    const llmCategorySeeds = ["mrr tracking tool"];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Startup tools", phrases: ["mrr tracking tool"] },
      niche: { label: "MRR verification", phrases: ["mrr verification tool"] },
    };

    const gathered = await gatherFreeSearchVisibility("trustmrr.com", seedText, llmCategorySeeds, undefined, [], categoryNiche);

    // The ladder actually ran (not a no-op stand-in).
    expect(gathered.categoryCard?.demand).toBeGreaterThanOrEqual(CATEGORY_FLOOR);

    // …and it did not touch score: classifying the SAME rows/vocab directly —
    // no ladder, no cards — produces the identical score the gather returned.
    const expected = classifyFootprint("trustmrr.com", seedText, llmCategorySeeds, TRUSTMRR, []);
    expect(gathered.score).toBe(expected.score);
  });
});

// ---------------------------------------------------------------------------
// P2 review fix (2026-07-20): the missing boundary guard. At realistic MAX
// phrase counts the unique phrase set headed for the ONE `cachedKeywordVolumes`
// batch reaches ~60+ — well past the OLD 40-item cap — and the OLD assembly
// order (`[...seeds, ...tierPhrases, ...cardSeeds]`, cardSeeds LAST, and within
// each phrase's ladder candidates the single-token broadest form generated
// LAST) silently dropped up to 10 of 16 single-token ladder candidates: the
// exact terms that clear CATEGORY_FLOOR. `computeCategoryLadder` then read a
// truncated `volumesByKeyword`, found the floor-clearing umbrella term absent,
// and wrongly reported "ladder exhausted" — the CATEGORY-must-be-LARGE
// guarantee (D2) silently failing at scale. This guard prices the actual
// batch a live scan sends and asserts every essential phrase survives.
// ---------------------------------------------------------------------------
describe("gatherFreeSearchVisibility — the volumes batch never truncates essential card-seed phrases (P2 review fix)", () => {
  it("at realistic MAX phrase counts (6 category, 6 niche, 8 tier) every category phrase, niche phrase, and single-token ladder candidate rides the priced batch — only lower-priority legacy phrases may be cut", async () => {
    gatherRankedSpy.mockResolvedValueOnce(TRUSTMRR);
    gatherOverviewSpy.mockResolvedValueOnce(null);
    gatherVolumesSpy.mockResolvedValueOnce([]); // volumes content is irrelevant here — only the REQUEST shape is under test

    // 6 category phrases, 6 tokens each, deliberately DISTINCT vocabulary
    // across phrases (worst case for the ladder — no token sharing means no
    // free dedup) — realistic upper end of "usually 2-3 words" (synth.ts
    // prompt) but within the hard 6-phrase LadderSeeds.phrases cap.
    const categoryPhrases = [
      "seo keyword audit checker report tool",
      "calendar meeting booking scheduler event widget",
      "social content post publisher schedule panel",
      "growth funnel metrics tracker insight suite",
      "invoice billing payment ledger record system",
      "helpdesk ticket queue routing escalation manager",
    ];
    // 6 niche phrases (hard cap) — content irrelevant to grounding here, this
    // test is about batch truncation, not the grounding guard (covered above).
    const nichePhrases = [
      "seo audit reporting for digital agencies",
      "booking scheduler for solo consultants",
      "content publisher for indie creators",
      "funnel insight dashboards for founders",
      "invoice ledger tracking for freelancers",
      "ticket escalation flows for support teams",
    ];
    const categoryNiche: CategoryNicheSeeds = {
      category: { label: "Ops tooling", phrases: categoryPhrases },
      niche: { label: "Ops tooling for small teams", phrases: nichePhrases },
    };
    // 8 market-tier phrases (broad 4 + niche 4, the M1 hard cap) — grounded
    // against TRUSTMRR's real category rows (exact-rank match or a shared
    // mrr/startup token), same family as the existing invariant-#1 test.
    const tierSeeds = {
      broad: ["startup mrr", "mrr app", "startup mrr revenue", "mrr saas dashboard"],
      niche: ["mrr saas", "startup revenue", "mrr app tracker", "startup revenue report"],
    };
    // 8 legacy category-demand seeds (the `buildCategorySeeds` llm branch,
    // capped at 8) — mrr/startup themed so TRUSTMRR's real category rows
    // still classify correctly (same vocabulary family as invariant-#1).
    const llmCategorySeeds = [
      "startup mrr tool", "mrr saas platform", "startup revenue app", "mrr tracking service",
      "startup growth service", "mrr analytics tool", "startup finance app", "mrr insight tool",
    ];

    await gatherFreeSearchVisibility(
      "trustmrr.com", ["startup mrr revenue saas tracking"], llmCategorySeeds, tierSeeds, [], categoryNiche,
    );

    // The spy is shared/uncleared across this file's other gather-level
    // tests — read the LAST call (this test's own), not an absolute count.
    const priced = gatherVolumesSpy.mock.calls.at(-1)![0] as string[];
    const pricedSet = new Set(priced);

    // Every category phrase, every niche phrase, and every essential ladder
    // candidate (single-token forms + one intermediate per phrase) survives —
    // none silently dropped.
    const essential = [
      ...categoryPhrases,
      ...categoryPhrases.flatMap((p) => essentialLadderCandidates(p)),
      ...nichePhrases,
    ].map((s) => s.toLowerCase().trim());
    const missingEssential = essential.filter((p) => !pricedSet.has(p));
    expect(missingEssential).toEqual([]);

    // The exact failure mode this closes: a floor-clearing SINGLE-TOKEN
    // umbrella term (e.g. "seo", "scheduling") is never truncated.
    const singleTokenCandidates = categoryPhrases
      .flatMap((p) => essentialLadderCandidates(p))
      .filter((c) => !c.includes(" "));
    expect(singleTokenCandidates.length).toBeGreaterThan(0);
    for (const t of singleTokenCandidates) expect(pricedSet.has(t)).toBe(true);

    // The batch stays within the documented cap...
    expect(priced.length).toBeLessThanOrEqual(60);
    // ...and this scenario is a genuine stress case, not a vacuous one: the
    // essential set ALONE plus the deterministic legacy seeds already exceeds
    // the cap, so SOMETHING must be cut — proving the priority order (not
    // just a big-enough cap) is what's under test.
    expect(new Set([...essential, ...llmCategorySeeds]).size).toBeGreaterThan(60);
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
import { expectCallsSymbol, stripNoise, extractFunctionBody } from "@/lib/testing/tripwire";

describe("free-scan number honesty (guards G1, G2)", () => {
  it("G1: the SearchVisibility type carries NO categoryCaptureRate / categoryCapturedSearches field", () => {
    // These were `= sv.score` (G1: a metric aliased to another) and its incoherent
    // internal numerator. A type-level assertion: the fields must not exist.
    const sv: SearchVisibility = {
      score: 5, keywordsRanked: 2100, estMonthlyVisits: 100, footprintComplete: true,
      brandPct: 10, categoryPct: 20, aggregatedPct: 0, offTopicPct: 70, categoryGap: [], offTopicExamples: [], aggregatedExamples: [],
      categoryWins: 0, categoryDemand: 1000, categoryOpportunities: [], categoryPhrases: [], categoryRanked: [], categoryWonKeywords: [],
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

describe("free-scan copy honesty (guards G4, G6)", () => {
  it("G4: categoryDemand reconciles — it is exactly Σ categoryPhrases volumes", () => {
    const seedVolumes = [
      { keyword: "email api", volume: 590 },
      { keyword: "email delivery service", volume: 590 },
      { keyword: "transactional email api", volume: 70 },
    ];
    const d = computeCategoryDemand(seedVolumes, new Map());
    const sumOfParts = d.categoryPhrases.reduce((s, p) => s + p.volume, 0);
    expect(d.categoryDemand).toBe(sumOfParts); // the total IS the sum of its named parts
    expect(d.categoryDemand).toBe(1250);
    expect(d.categoryPhrases.map((p) => p.keyword)).toContain("email api");
  });

  it("G6 (source): results-screen contains NO hardcoded signal count (`N signals`/`N-signal`)", () => {
    // "18 signals" over-stated what a free scan measures (~9). The count must be
    // computed or absent, never a literal. Source tripwire.
    const src = readFileSync(resolve(process.cwd(), "components/report/captured/results-screen.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); // strip comments
    expect(src).not.toMatch(/\d+\s*signals?\b/i);
    expect(src).not.toMatch(/\d+-signal\b/i);
  });
});

describe("free↔paid demand vocabulary (guard G7)", () => {
  // §1.9: the bare phrase "monthly searches" labelled FOUR different computations
  // across the demand surfaces — free Σ seed volumes, paid Σ keyword_ideas, Σ
  // content-plan volume, and a pre-filter raw total. A user upgrading saw three
  // different answers to one question with no reconciliation. Each concept now has
  // ONE distinct, scoped label: "Category demand" (free), "Addressable demand"
  // (demand tab), "across your content plan" (synthesis). The ambiguous collision
  // phrase is retired from every PRODUCTION demand-render surface; a fifth variant
  // must pick a scoped label, not re-introduce the ambiguity.
  const DEMAND_SURFACES = [
    "components/report/captured/results-screen.tsx", // free report (Category demand)
    "components/app/intel/demand-view.tsx", // paid demand tab (Addressable demand)
    "components/app/intel/synthesis-view.tsx", // paid strategy (Volume opportunity)
    "lib/scan/demand/gather.ts", // the progress toast (a detail, not a metric)
  ];

  it("G7: no production demand surface labels a value with the bare 'monthly searches'", () => {
    for (const f of DEMAND_SURFACES) {
      const src = readFileSync(resolve(process.cwd(), f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""); // strip comments — they may legitimately explain the fix
      expect(src, `${f} must not label a value "monthly searches" (§1.9 collision phrase)`).not.toMatch(/monthly searches/i);
    }
  });
});

describe("computeMarketTiers (Task B, 2026-07-19) — the broad/niche ladder, medium dropped", () => {
  const volumes = new Map([
    ["marketing software", 550000],
    ["seo tools", 74000],
    ["rank tracking software", 1600],
  ]);
  const ranks = new Map([["seo tools", 12]]);
  // PR-8 grounding: every phrase below must be corroborated by SOME real-ranking
  // evidence. "seo tools" is grounded by the exact-rank map above; "marketing
  // software" and "rank tracking software" are grounded here via a shared
  // non-generic token ("marketing" / "rank"+"tracker") with the subject's REAL
  // category rankings — standing in for a real categoryRanked fixture so these
  // pre-existing ladder-mechanics tests aren't ALSO asserting the grounding rule
  // (that has its own describe block below).
  const groundedCategoryRanked = [
    { keyword: "marketing tool", volume: 5000, yourPosition: 5 },
    { keyword: "rank tracker", volume: 3000, yourPosition: 8 },
  ];

  it("each tier's demand reconciles EXACTLY to its rendered phrases (G4-per-tier)", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], niche: ["rank tracking software"] },
      volumes,
      ranks,
      [],
      0,
      groundedCategoryRanked,
    );
    for (const t of tiers) {
      expect(t.demand).toBe(t.phrases.reduce((s, p) => s + p.volume, 0));
      expect(t.phrases.length).toBeGreaterThan(0);
    }
    expect(tiers.map((t) => t.tier)).toEqual(["broad", "niche"]); // medium never emitted, ever
  });

  it("standing comes from the REAL rank map — never invented", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], niche: ["seo tools"] },
      volumes,
      ranks,
      [],
      0,
      groundedCategoryRanked,
    );
    expect(tiers.find((t) => t.tier === "broad")!.bestPosition).toBeNull();
    expect(tiers.find((t) => t.tier === "niche")!.bestPosition).toBe(12);
  });

  it("a tier whose phrases all price to 0 volume is omitted (degrade, never render a hollow rung)", () => {
    const tiers = computeMarketTiers(
      { broad: ["zzz unknown"], niche: ["seo tools"] },
      volumes,
      ranks,
      [],
      0,
      groundedCategoryRanked,
    );
    expect(tiers.map((t) => t.tier)).toEqual(["niche"]);
  });

  it("cross-rung dedup: a phrase already in the category phrase set never appears in a rung", () => {
    const categoryPhrases = [{ keyword: "seo tools", volume: 74000 }];
    const tiers = computeMarketTiers(
      { broad: ["marketing software", "seo tools"], niche: ["seo tools"] },
      volumes,
      ranks,
      categoryPhrases,
      0,
      groundedCategoryRanked,
    );
    const allKeywords = tiers.flatMap((t) => t.phrases.map((p) => p.keyword));
    expect(allKeywords).not.toContain("seo tools");
    expect(allKeywords).toContain("marketing software");
  });

  it("cross-rung dedup: a phrase seeded in BOTH broad and niche keeps niche only", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software", "rank tracking software"], niche: ["rank tracking software"] },
      volumes,
      ranks,
      [],
      0,
      groundedCategoryRanked,
    );
    const broadT = tiers.find((t) => t.tier === "broad")!;
    const nicheT = tiers.find((t) => t.tier === "niche")!;
    expect(nicheT.phrases.some((p) => p.keyword === "rank tracking software")).toBe(true);
    expect(broadT.phrases.some((p) => p.keyword === "rank tracking software")).toBe(false);
  });

  it("inversion guard: broad rung is DROPPED when its priced demand does not exceed category demand", () => {
    // "seo tools" alone prices to 74,000 — below a 112,420 category demand, the
    // reachkit.app live shape (broad 5,200 <= category 112,420, inverted).
    const tiers = computeMarketTiers({ broad: ["seo tools"], niche: [] }, volumes, ranks, [], 112420, groundedCategoryRanked);
    expect(tiers.find((t) => t.tier === "broad")).toBeUndefined();
  });

  it("inversion guard: EQUAL broad/category demand is also dropped (≤, not <)", () => {
    const tiers = computeMarketTiers({ broad: ["seo tools"], niche: [] }, volumes, ranks, [], 74000, groundedCategoryRanked);
    expect(tiers.find((t) => t.tier === "broad")).toBeUndefined();
  });

  it("inversion guard: broad rung RENDERS when its priced demand exceeds category demand", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], niche: [] },
      volumes,
      ranks,
      [],
      112420,
      groundedCategoryRanked,
    );
    expect(tiers.find((t) => t.tier === "broad")).toBeDefined();
  });
});

describe("computeMarketTiers grounding (PR-8, 2026-07-20) — no LLM-guessed markets (the trustmrr class)", () => {
  // VERIFIED live trustmrr.com data (raw DataForSEO cache bodies, task-F brief):
  // the LLM's broad tier-seed "business intelligence platforms" priced to a REAL
  // 880/mo, but trustmrr does not rank for it and is not a BI platform — it
  // shares zero non-generic token with trustmrr's REAL category rankings (mrr /
  // startup / app / revenue). Real number, fabricated relevance — the same
  // LLM-hallucination class as the classifier macro rule, one layer up.
  const trustmrrCategoryRanked = [
    { keyword: "mrr startup", volume: 90, yourPosition: 2 },
    { keyword: "startup mrr", volume: 90, yourPosition: 2 },
    { keyword: "mrr app", volume: 70, yourPosition: 1 },
    { keyword: "startup revenue", volume: 30, yourPosition: 2 },
  ];
  const trustmrrVolumes = new Map([
    ["business intelligence platforms", 880],
    ["startup acquisition software", 0],
  ]);
  const emptyRanks = new Map<string, number>();

  it("an ungrounded broad phrase is DROPPED even though its volume is real (trustmrr 'business intelligence platforms')", () => {
    const tiers = computeMarketTiers(
      { broad: ["business intelligence platforms", "startup acquisition software"], niche: [] },
      trustmrrVolumes,
      emptyRanks,
      [],
      0,
      trustmrrCategoryRanked,
    );
    const allPhrases = tiers.flatMap((t) => t.phrases.map((p) => p.keyword));
    expect(allPhrases).not.toContain("business intelligence platforms");
  });

  // PR-9 (2026-07-20, the "platform"/"platforms" class, code-review finding):
  // the overlap check tokenized without stemming, so "platforms" (in the
  // subject's REAL category ranking "saas platforms") and "platforms" (in the
  // hallucinated broad tier-seed) matched as literal-equal strings — but
  // "platform" (singular) is ALREADY in GENERIC_TOKENS as a word that alone
  // proves nothing; its plural "platforms" was NOT separately listed, so the
  // exact same generic word in its plural form sailed through as if it were
  // real evidence. A wordlist fix (add "platforms" to GENERIC_TOKENS) patches
  // this ONE plural and leaves the next one (any other generic noun's plural,
  // or a gerund) exploitable the same way. This test is the reviewer's exact
  // live repro and must pass via STEMMING, not a new list entry.
  it("a broad phrase sharing ONLY the plural of a generic word ('platforms') with categoryRanked is NOT grounded (stemming, not a wordlist entry)", () => {
    const categoryRanked = [{ keyword: "saas platforms", volume: 500, yourPosition: 5 }];
    const volumes = new Map([["business intelligence platforms", 300]]);
    const tiers = computeMarketTiers(
      { broad: ["business intelligence platforms"], niche: [] },
      volumes,
      emptyRanks,
      [],
      0,
      categoryRanked,
    );
    const allPhrases = tiers.flatMap((t) => t.phrases.map((p) => p.keyword));
    expect(allPhrases).not.toContain("business intelligence platforms");
  });

  it("positive control: a broad phrase sharing a non-generic token with categoryRanked SURVIVES (must not over-drop)", () => {
    // SpaceX-shaped: categoryRanked has "rocket launch" + "space launch system"
    // (real rankings); a broad seed "space exploration" shares "space" -> kept.
    const spacexCategoryRanked = [
      { keyword: "rocket launch", volume: 74000, yourPosition: 4 },
      { keyword: "space launch system", volume: 110000, yourPosition: 10 },
    ];
    const volumes = new Map([["space exploration", 40000]]);
    const tiers = computeMarketTiers(
      { broad: ["space exploration"], niche: [] },
      volumes,
      emptyRanks,
      [],
      0,
      spacexCategoryRanked,
    );
    const broad = tiers.find((t) => t.tier === "broad");
    expect(broad).toBeDefined();
    expect(broad!.phrases.map((p) => p.keyword)).toContain("space exploration");
  });

  it("a phrase the subject ranks for EXACTLY is grounded even with zero token overlap", () => {
    const volumes = new Map([["totally unrelated phrase", 500]]);
    const ranks = new Map([["totally unrelated phrase", 5]]);
    const tiers = computeMarketTiers(
      { broad: ["totally unrelated phrase"], niche: [] },
      volumes,
      ranks,
      [],
      0,
      trustmrrCategoryRanked,
    );
    const broad = tiers.find((t) => t.tier === "broad");
    expect(broad!.phrases.map((p) => p.keyword)).toContain("totally unrelated phrase");
  });

  it("empty categoryRanked -> the WHOLE ladder is omitted (no ranking evidence of the subject's market at all)", () => {
    const volumes = new Map([["marketing software", 550000]]);
    const ranks = new Map([["marketing software", 3]]); // even an exact rank match
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], niche: ["marketing software"] },
      volumes,
      ranks,
      [],
      0,
      [], // no real in-category rankings — degrade, never invent
    );
    expect(tiers).toEqual([]);
  });
});

describe("M2 paid parity — the deep pass threads tier seeds too", () => {
  // Without this, a paid upgrade REGENERATES searchVisibility via
  // gatherFreeSearchVisibility without marketTiers and the ladder silently
  // vanishes on upgrade. expectCallsSymbol alone (existence of the call)
  // isn't enough to catch a dropped argument, so this pins the exact
  // call-site ARITY inside runFullScan's own brace-matched,
  // comment/string-stripped body — a naive whole-file substring check would
  // be satisfied by an unrelated mention elsewhere.
  // PR-5 (2026-07-19): a 5th argument (brandNames, `facts.listing.name`) was
  // added so the brand vocabulary isn't limited to the domain label alone —
  // bumped 4 -> 5 here too, so a dropped brandNames arg on the paid path
  // (silently reverting x.com-class subjects to brandPct 0 on upgrade) fails
  // the same way a dropped tierSeeds arg already did.
  // P2 (2026-07-20, data board): a 6th argument (categoryNicheSeeds) was added
  // so categoryCard/nicheCard don't silently vanish when a scan is deepened
  // post-upgrade — bumped 5 -> 6 here too, same discipline.
  it("full-scan.ts: runFullScan calls gatherFreeSearchVisibility(...) with a 6th (categoryNicheSeeds) argument", () => {
    expect(() => expectCallsSymbol("lib/scan/full-scan.ts", "gatherFreeSearchVisibility", { within: "runFullScan" })).not.toThrow();

    const src = readFileSync(resolve(process.cwd(), "lib/scan/full-scan.ts"), "utf8");
    const clean = stripNoise(src);
    const body = extractFunctionBody(clean, "runFullScan", "lib/scan/full-scan.ts");
    const call = /gatherFreeSearchVisibility\(([^)]*)\)/.exec(body);
    expect(call, "expected a gatherFreeSearchVisibility(...) call inside runFullScan").not.toBeNull();
    const args = call![1]!;
    const argCount = args.split(",").length;
    expect(argCount, `expected 6 args (rawSelf, seedText, catSeeds, tierSeeds, brandNames, categoryNicheSeeds) — got: ${args}`).toBe(6);
  });
});

describe("mega-brand matching is phrase-blind (the 'fox news' class, live scan aae8a31d)", () => {
  // MEGA_BRAND_TOKENS stores multi-word entities as ONE concatenated token
  // ("foxnews", "nypost", "nytimes") because a token-by-token check can only ever
  // compare single tokens. Tokenizing the keyword "fox news" gives ["fox","news"] —
  // neither of which is "foxnews" — so the entry was structurally unreachable via
  // the two-word phrase real users search for. Reproduces today's live inputs: the
  // lite synth's marketTiers prompt legitimized "news" as a corroborated category
  // token via the seed "real-time news feed", which (pre-fix) let "fox news" ride
  // that legitimized generic token straight into "category".
  const rk = (keyword: string, position: number, volume: number, etv: number): RankedKeyword => ({
    keyword, position, volume, etv, url: "https://x.com/x",
  });

  it("joins adjacent tokens (bigram) so a multi-word entity name matches: fox+news=foxnews", () => {
    const sv = classifyFootprint(
      "x.com",
      ["a real-time news feed and microblogging platform"],
      ["real-time news feed", "microblogging platform", "social media network"],
      [
        rk("fox news", 8, 37200000, 1744680),
        rk("cnn", 10, 20400000, 1344360),
        rk("microblogging platform", 5, 1000, 500),
        rk("social media network", 6, 900, 450),
      ],
    );
    const category = new Set(sv.categoryRanked.map((r) => r.keyword));
    expect(category.has("fox news"), "fox news must NOT ride the legitimized 'news' token into category").toBe(false);
    expect(category.has("cnn"), "cnn must stay off-topic").toBe(false);
    // The legitimately-named categories must be unaffected by the mega-brand fix.
    expect(category.has("microblogging platform")).toBe(true);
    expect(category.has("social media network")).toBe(true);
  });

  it("a keyword that is ONLY a fragment of a mega-brand bigram (not the full pair) is unaffected", () => {
    // "fox" alone (e.g. "fox sports") and "news" alone (e.g. "world news today")
    // must not be treated as the mega-brand — only the adjacent PAIR "fox news"
    // (or a token that IS itself a stored entry, like "cnn") is off-topic.
    // Under the macro rule (Part A2) EVERY non-generic token must be supported,
    // so "fox" now needs real vocabulary evidence — supplied honestly here via
    // the site's OWN positioning prose (this sports-news aggregator genuinely
    // covers Fox Sports content), not a rule-level special case.
    const sv = classifyFootprint(
      "sportsnews.com",
      ["daily sports news and scores, including fox sports highlights"],
      ["sports news roundup"],
      [
        rk("fox sports scores", 4, 500, 200),
        rk("world news today", 6, 400, 150),
      ],
    );
    const category = new Set(sv.categoryRanked.map((r) => r.keyword));
    expect(category.has("fox sports scores")).toBe(true);
    expect(category.has("world news today")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE MACRO RULE (2026-07-19, Part A2): a curated MEGA_BRAND_TOKENS blocklist
// can never enumerate the world's entities — the "fox news"/"what time is it
// in hawaii" class recurs for ANY unlisted proper noun that happens to share
// one corroborated generic token with the subject's vocabulary. The rule
// change: category requires EVERY non-generic token of the keyword to be
// supported (subject vocab, a corroborated LLM-seed token, or GENERIC_TOKENS)
// — one unsupported token anywhere in the phrase forecloses category,
// structurally, with no blocklist entry needed for the new entity.
// ---------------------------------------------------------------------------
describe("classification requires ALL non-generic tokens supported (the macro rule, no blocklist needed)", () => {
  // A time-tracking product whose OWN seed corroborates "time" into its
  // category vocabulary — exactly the mechanism that let "news" ride "fox
  // news" into category. Reproduces the class generically (no MEGA_BRAND_TOKENS
  // entry exists for "hawaii"/"tokyo" — there cannot be one for every place name).
  const sv = classifyFootprint(
    "chronotrack.com",
    ["accurate time tracking software for distributed teams"],
    ["time tracking software", "employee time clock"],
    [
      rk2("time tracking app", 2, 5000, 2000), // real category — both tokens supported
      rk2("employee time clock", 3, 2000, 800), // real category — corroborated + vocab
      rk2("what time is it in hawaii", 5, 550000, 90000), // "time" corroborated, "hawaii" is NOT
      rk2("time zone converter tokyo", 6, 300000, 40000), // "time" corroborated, "tokyo" is NOT
    ],
  );
  const category = new Set(sv.categoryRanked.map((r) => r.keyword));

  it("a keyword with one corroborated-generic token + one wholly unsupported token is OFFTOPIC, not category", () => {
    expect(category.has("what time is it in hawaii"), "hawaii is unsupported — must not ride 'time' into category").toBe(false);
    expect(category.has("time zone converter tokyo"), "tokyo is unsupported — must not ride 'time' into category").toBe(false);
  });

  it("the subject's REAL category terms (all tokens supported) are unaffected", () => {
    expect(category.has("time tracking app")).toBe(true);
    expect(category.has("employee time clock")).toBe(true);
  });

  // Task-G (2026-07-20, VERIFIED live evidence, savvycal.com): "time in hi" (a
  // Hawaii-timezone lookup) classified as CATEGORY because tokens() drops
  // tokens shorter than 3 chars — "in" is filler, "hi" is silently dropped for
  // being 2 chars — leaving ONLY the corroborated-generic "time" to satisfy
  // the macro rule vacuously. Same chronotrack fixture (its own seeds
  // corroborate "time" the same way savvycal's did live) — reproduces the
  // class generically, not just on the savvycal corpus fixture.
  it("a 2-char geo abbreviation ('hi') is NOT silently dropped — 'time in hi' forecloses to off-topic", () => {
    const svWithGeo = classifyFootprint(
      "chronotrack.com",
      ["accurate time tracking software for distributed teams"],
      ["time tracking software", "employee time clock"],
      [
        rk2("time tracking app", 2, 5000, 2000),
        rk2("time in hi", 5, 246000, 90000), // "time" corroborated, "hi" is a 2-char geo token, unsupported
      ],
    );
    const cat = new Set(svWithGeo.categoryRanked.map((r) => r.keyword));
    expect(cat.has("time in hi"), "the 2-char geo token 'hi' must not be silently dropped").toBe(false);
    expect(cat.has("time tracking app")).toBe(true); // the fix must not over-drop real category terms
  });

  // Task-G review fix (2026-07-20, Critical finding, reproduced live against an
  // email-capture SaaS): keeping 2-char tokens (the fix above, so "hi" survives)
  // also stopped "in" from being silently dropped — but SHORT_STOPWORDS never
  // listed "in" as a filler word, so a legitimate category phrase using "in" as
  // grammatical filler ("opt in form builder", "log in", "built in") now
  // requires "in" ITSELF to be vocab-supported under the macro rule, which no
  // real subject vocabulary provides for a bare function word. That forecloses
  // the whole phrase to off-topic even though every CONTENT token ("opt",
  // "form", "builder") is fully supported. Fix: complete the closed set of
  // 2-char English function words in SHORT_STOPWORDS ("in", "or", "ok"), so
  // "in" is filtered out of tokens() the same way "at"/"to"/"on" already are —
  // while "hi" (Hawaii, CONTENT) stays a real token, per the test above.
  it("'opt in form builder' — 'in' as grammatical filler — classifies CATEGORY when its content tokens are supported", () => {
    // Deliberately keeps "in" OUT of the seed text/LLM seeds (which use "opt
    // into" / "opt form builder", never the bare word "in") so the vocabulary
    // never accidentally corroborates "in" itself — the ONLY thing standing
    // between "opt in form builder" and category must be SHORT_STOPWORDS,
    // not incidental seed overlap.
    const svOptIn = classifyFootprint(
      "capturely.com",
      ["a drag and drop form builder that lets visitors opt into your email list"],
      ["opt form builder", "email capture widget"],
      [
        rk2("opt in form builder", 3, 2400, 900), // "opt"/"form"/"builder" supported; "in" is pure filler
        rk2("email capture widget", 4, 1800, 600),
      ],
    );
    const cat = new Set(svOptIn.categoryRanked.map((r) => r.keyword));
    expect(cat.has("opt in form builder"), "a filler 'in' must not foreclose an otherwise fully-supported category phrase").toBe(true);
    expect(cat.has("email capture widget")).toBe(true);
  });
});

function rk2(keyword: string, position: number, volume: number, etv: number): RankedKeyword {
  return { keyword, position, volume, etv, url: "https://chronotrack.com/x" };
}

// ---------------------------------------------------------------------------
// PR-5 (2026-07-19): the brand≠domain class. Live evidence: x.com scans read
// "your brand 0% / other companies' names 100%" because brand tokens derive
// ONLY from the domain ("x.com" -> unusable "x", 1 char, dropped by
// brandTokensFor's len>=3 floor) — the subject's REAL brand ("twitter") is
// unrecognised AND sits in MEGA_BRAND_TOKENS, so x.com's own brand queries
// count as "other companies' names". Fix: `facts.listing.name` (the subject's
// REAL captured name) joins the brand vocabulary via classifyFootprint's own
// signature (no side channel — the corpus fixture below exercises the exact
// same path).
// ---------------------------------------------------------------------------
describe("PR-5: subject brand names join the brand vocabulary (the brand≠domain class)", () => {
  const rows: RankedKeyword[] = [
    kw("twitter", 1, 16600000, 5046400),
    kw("twitter login", 2, 500000, 150000),
    kw("google", 9, 101000000, 3413800), // ubiquitous other-brand, off-topic regardless
    kw("microblogging platform", 5, 1000, 500), // the subject's real category term
  ];
  const seedText = ["a microblogging platform for real-time updates"];
  const llmSeeds = ["microblogging platform"];

  it("WITHOUT brandNames: 'twitter' is unrecognised as brand — mistaken for another company's name", () => {
    const sv = classifyFootprint("x.com", seedText, llmSeeds, rows);
    expect(sv.brandPct).toBe(0);
    expect(sv.offTopicExamples).toContain("twitter");
  });

  it("WITH brandNames ['Twitter / X']: 'twitter…' rows classify BRAND, brandPct > 0", () => {
    const sv = classifyFootprint("x.com", seedText, llmSeeds, rows, ["Twitter / X"]);
    expect(sv.brandPct).toBeGreaterThan(0);
    expect(sv.offTopicExamples).not.toContain("twitter");
    expect(sv.offTopicExamples).not.toContain("twitter login");
  });

  it("mega-brand exemption: a subject brand token that IS a MEGA_BRAND_TOKENS member (e.g. 'twitter') is never off-topic for its own scan", () => {
    // Direct proof the exemption bites: without brandNames "twitter" (alone) is
    // mega-brand off-topic; with brandNames it is the subject's own brand.
    const without = classifyFootprint("x.com", seedText, llmSeeds, [kw("twitter", 1, 16600000, 5046400)]);
    const withBrand = classifyFootprint("x.com", seedText, llmSeeds, [kw("twitter", 1, 16600000, 5046400)], ["Twitter / X"]);
    expect(without.brandPct).toBe(0);
    expect(withBrand.brandPct).toBeGreaterThan(0);
  });

  it("invariant #1: brand-vs-offtopic reassignment does NOT touch category strength — score is unchanged with/without brandNames", () => {
    const without = classifyFootprint("x.com", seedText, llmSeeds, rows);
    const withBrand = classifyFootprint("x.com", seedText, llmSeeds, rows, ["Twitter / X"]);
    expect(withBrand.score).toBe(without.score);
    // Sanity: the reassignment DID actually move brandPct (else this proves nothing).
    expect(withBrand.brandPct).not.toBe(without.brandPct);
  });

  it("a generic word in the listing name does not itself become a brand token", () => {
    // "Platform" is a GENERIC_TOKEN — a listing name like "Twitter Platform"
    // must not let every generic "platform" query become brand.
    const sv = classifyFootprint("x.com", seedText, llmSeeds, rows, ["Twitter Platform"]);
    // "microblogging platform" still classifies on ITS OWN vocab support
    // (llm seed corroboration), not because "platform" became a brand token.
    expect(sv.categoryRanked.map((r) => r.keyword)).toContain("microblogging platform");
  });
});

// ---------------------------------------------------------------------------
// Fix 3 (PR-5): offTopicExamples is a PRESENTATION rule — which 3 of N real,
// honest off-topic keywords we choose to PRINT on the conversion surface. A
// live footprint can rank for adult-site terms via MEGA_BRAND_TOKENS entries
// ("pornhub", "onlyfans", "chaturbate") — real, true data, but not fit to
// quote verbatim on a public page. The underlying klass/percentages are
// UNCHANGED; only the printed EXAMPLES are filtered.
// ---------------------------------------------------------------------------
describe("offTopicExamples: NSFW/profane candidates are never selected for display (Fix 3)", () => {
  const vocab = buildVocab("cleansaas.com", ["startup analytics dashboard for founders"]);

  it("skips an NSFW candidate even when it is the HIGHEST-volume off-topic row", () => {
    const rows: RankedKeyword[] = [
      kw("pornhub", 5, 50000000, 900000), // NSFW, huge volume — must not be printed
      kw("cometly", 8, 60500, 1901.8), // clean off-topic, smaller volume
      kw("shipfast", 13, 720, 8.1), // clean off-topic
    ];
    const v = computeSearchVisibility(rows, vocab);
    expect(v.offTopicExamples).not.toContain("pornhub");
    expect(v.offTopicExamples).toContain("cometly");
    expect(v.offTopicExamples).toContain("shipfast");
    // The DATA (percentages) still reflect the NSFW row honestly — only the
    // printed examples are filtered, never the underlying split.
    expect(v.offTopicPct).toBeGreaterThan(0);
  });

  it("renders NO examples (never a fabricated substitute) when every off-topic candidate is NSFW", () => {
    const rows: RankedKeyword[] = [
      kw("pornhub", 5, 50000000, 900000),
      kw("onlyfans", 6, 20000000, 400000),
    ];
    const v = computeSearchVisibility(rows, vocab);
    expect(v.offTopicExamples).toEqual([]);
    // The warning still stands on its percentages even with zero named examples.
    expect(v.offTopicPct).toBeGreaterThan(0);
  });
});
