/**
 * search-visibility.test.ts — the free-tier honest gap metric. Validated against
 * trustmrr.com's REAL ranked-keyword footprint (a startup-revenue directory), the
 * adversarial case: clean site, tiny category, ~90% other-brand visibility.
 */
import { describe, it, expect } from "vitest";
import { computeSearchVisibility, buildVocab, computeCategoryDemand, buildCategorySeeds, computeMarketTiers, classifyFootprint, stem } from "./search-visibility";
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
      brandPct: 10, categoryPct: 20, offTopicPct: 70, categoryGap: [], offTopicExamples: [],
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

  it("each tier's demand reconciles EXACTLY to its rendered phrases (G4-per-tier)", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], niche: ["rank tracking software"] },
      volumes,
      ranks,
      [],
      0,
    );
    for (const t of tiers) {
      expect(t.demand).toBe(t.phrases.reduce((s, p) => s + p.volume, 0));
      expect(t.phrases.length).toBeGreaterThan(0);
    }
    expect(tiers.map((t) => t.tier)).toEqual(["broad", "niche"]); // medium never emitted, ever
  });

  it("standing comes from the REAL rank map — never invented", () => {
    const tiers = computeMarketTiers({ broad: ["marketing software"], niche: ["seo tools"] }, volumes, ranks, [], 0);
    expect(tiers.find((t) => t.tier === "broad")!.bestPosition).toBeNull();
    expect(tiers.find((t) => t.tier === "niche")!.bestPosition).toBe(12);
  });

  it("a tier whose phrases all price to 0 volume is omitted (degrade, never render a hollow rung)", () => {
    const tiers = computeMarketTiers({ broad: ["zzz unknown"], niche: ["seo tools"] }, volumes, ranks, [], 0);
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
    );
    const broadT = tiers.find((t) => t.tier === "broad")!;
    const nicheT = tiers.find((t) => t.tier === "niche")!;
    expect(nicheT.phrases.some((p) => p.keyword === "rank tracking software")).toBe(true);
    expect(broadT.phrases.some((p) => p.keyword === "rank tracking software")).toBe(false);
  });

  it("inversion guard: broad rung is DROPPED when its priced demand does not exceed category demand", () => {
    // "seo tools" alone prices to 74,000 — below a 112,420 category demand, the
    // reachkit.app live shape (broad 5,200 <= category 112,420, inverted).
    const tiers = computeMarketTiers({ broad: ["seo tools"], niche: [] }, volumes, ranks, [], 112420);
    expect(tiers.find((t) => t.tier === "broad")).toBeUndefined();
  });

  it("inversion guard: EQUAL broad/category demand is also dropped (≤, not <)", () => {
    const tiers = computeMarketTiers({ broad: ["seo tools"], niche: [] }, volumes, ranks, [], 74000);
    expect(tiers.find((t) => t.tier === "broad")).toBeUndefined();
  });

  it("inversion guard: broad rung RENDERS when its priced demand exceeds category demand", () => {
    const tiers = computeMarketTiers({ broad: ["marketing software"], niche: [] }, volumes, ranks, [], 112420);
    expect(tiers.find((t) => t.tier === "broad")).toBeDefined();
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
  it("full-scan.ts: runFullScan calls gatherFreeSearchVisibility(...) with a 5th (brandNames) argument", () => {
    expect(() => expectCallsSymbol("lib/scan/full-scan.ts", "gatherFreeSearchVisibility", { within: "runFullScan" })).not.toThrow();

    const src = readFileSync(resolve(process.cwd(), "lib/scan/full-scan.ts"), "utf8");
    const clean = stripNoise(src);
    const body = extractFunctionBody(clean, "runFullScan", "lib/scan/full-scan.ts");
    const call = /gatherFreeSearchVisibility\(([^)]*)\)/.exec(body);
    expect(call, "expected a gatherFreeSearchVisibility(...) call inside runFullScan").not.toBeNull();
    const args = call![1]!;
    const argCount = args.split(",").length;
    expect(argCount, `expected 5 args (rawSelf, seedText, catSeeds, tierSeeds, brandNames) — got: ${args}`).toBe(5);
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
