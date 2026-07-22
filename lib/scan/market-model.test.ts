/**
 * Phase A (2026-07-21) — "market size + your share" (R-3.14/R-3.15).
 *
 * Unit tests for the two new pure functions the market model rests on:
 * `pickCategoryLeader` (validate the leader domain) and `computeMarketFromLeader`
 * (size the CATEGORY market from a leader's real footprint + annotate the
 * subject's own position per phrase). Every volume here is a leader's REAL
 * ranked-keyword volume; the functions never fabricate a number.
 */
import { describe, it, expect } from "vitest";
import { pickCategoryLeader, computeMarketFromLeader, computeNicheMarket } from "./search-visibility";
import type { RankedKeyword } from "./adapters/dataforseo-ranked-keywords";
import type { DemandRow } from "./search-visibility";
import type { CategoryNicheSeeds } from "@/lib/llm/types";
import type { RelevanceVerdicts } from "./relevance-judge";

const seeds: CategoryNicheSeeds = {
  category: { label: "SEO tooling", phrases: ["seo tools", "seo software", "keyword research"] },
  niche: { label: "SEO for founders", phrases: ["seo tools for founders"] },
  leaders: ["ahrefs.com", "semrush.com"],
};

const kw = (keyword: string, position: number, volume: number): RankedKeyword => ({
  keyword,
  position,
  volume,
  etv: volume,
  url: `https://ahrefs.com/${keyword.replace(/\s/g, "-")}`,
});

describe("pickCategoryLeader (R-3.15 leader validation)", () => {
  it("picks the first valid leader, skipping the subject itself", () => {
    expect(pickCategoryLeader(["mysite.com", "ahrefs.com"], "https://mysite.com")).toBe("ahrefs.com");
  });
  it("skips aggregator/directory domains", () => {
    // g2.com is a review-aggregator (isAggregatorHost) — never a market leader.
    expect(pickCategoryLeader(["g2.com", "semrush.com"], "https://mysite.com")).toBe("semrush.com");
  });
  it("returns null when no leader survives (→ degrade to the subject ladder)", () => {
    expect(pickCategoryLeader([], "https://mysite.com")).toBeNull();
    expect(pickCategoryLeader(["mysite.com"], "https://mysite.com")).toBeNull();
  });
});

describe("computeMarketFromLeader (R-3.14 market size + your share)", () => {
  const leaderRows: RankedKeyword[] = [
    kw("seo tools", 1, 90000), // category — big
    kw("keyword research tool", 2, 40000), // category
    kw("backlink checker", 3, 12000), // category (shares "backlink"? no — but "checker" generic; needs a category token) — see note
    kw("ahrefs", 1, 30000), // leader BRAND — must be dropped
    kw("how to bake bread", 5, 500000), // off-category — must be dropped (no shared token)
    kw("seo software pricing", 4, 8000), // category
  ];

  it("sizes the market from category-relevant leader keywords only (Σ volume), dropping brand + off-topic", () => {
    const card = computeMarketFromLeader("ahrefs.com", leaderRows, seeds, new Map(), []);
    expect(card).not.toBeNull();
    const keywords = card!.phrases.map((p) => p.keyword);
    expect(keywords).toContain("seo tools");
    expect(keywords).toContain("seo software pricing");
    expect(keywords).not.toContain("ahrefs"); // leader brand dropped
    expect(keywords).not.toContain("how to bake bread"); // off-category dropped
    // demand reconciles to the rendered phrases (the G4 idiom)
    expect(card!.demand).toBe(card!.phrases.reduce((s, p) => s + p.volume, 0));
    // the market is LARGE — the leader's real footprint, not the subject's
    expect(card!.demand).toBeGreaterThan(90000);
  });

  it("annotates the subject's own position per phrase (your share) and splits won vs gaps", () => {
    // The subject ranks #2 for "seo tools" and nowhere else.
    const subjectRank = new Map<string, number>([["seo tools", 2]]);
    const card = computeMarketFromLeader("ahrefs.com", leaderRows, seeds, subjectRank, [])!;
    const won = card.rankedTop3.map((p) => p.keyword);
    expect(won).toEqual(["seo tools"]); // #2 ≤ 3 → won
    expect(card.gaps.map((p) => p.keyword)).not.toContain("seo tools");
    const seoTools = card.phrases.find((p) => p.keyword === "seo tools")!;
    expect(seoTools.yourPosition).toBe(2);
  });

  it("returns null when no leader keyword is category-relevant (→ degrade)", () => {
    const offCategory: RankedKeyword[] = [kw("bread recipes", 1, 1000), kw("cake tins", 2, 500)];
    expect(computeMarketFromLeader("ahrefs.com", offCategory, seeds, new Map(), [])).toBeNull();
  });
});

describe("computeMarketFromLeader — LLM relevance judge (Phase B, mixpanel-for-fathom class)", () => {
  // usefathom.com (WEB analytics) sized from mixpanel.com (PRODUCT/mobile
  // analytics). Every candidate below shares the token "analytics" with the
  // category, so TOKEN-OVERLAP alone keeps them all — and the generic
  // "data analytics tools" (301k) dominates the market number, the exact live
  // defect. The judge rules the adjacent/generic ones "irrelevant".
  const fathomSeeds: CategoryNicheSeeds = {
    category: { label: "Web Analytics", phrases: ["web analytics", "website analytics"] },
    niche: { label: "privacy-first web analytics", phrases: ["privacy analytics"] },
    leaders: ["mixpanel.com"],
  };
  const mixpanelRows: RankedKeyword[] = [
    kw("web analytics", 3, 49500),
    kw("website analytics", 5, 22000),
    kw("data analytics tools", 12, 301000), // generic — shares "analytics" only
    kw("mobile app analytics", 2, 40000), // different product — shares "analytics" only
    kw("product analytics", 1, 30000), // mixpanel's own market, not fathom's
  ];

  it("WITHOUT verdicts (degrade): token-overlap keeps the generic term and it dominates", () => {
    const card = computeMarketFromLeader("mixpanel.com", mixpanelRows, fathomSeeds, new Map(), [])!;
    const keywords = card.phrases.map((p) => p.keyword);
    expect(keywords).toContain("data analytics tools"); // the coarse over-inclusion
    // demand is inflated by the 301k generic term (the shipped defect)
    expect(card.demand).toBeGreaterThan(300000);
  });

  it("WITH verdicts: the judge drops the generic + adjacent terms; demand reflects the real category", () => {
    const verdicts: RelevanceVerdicts = new Map([
      ["web analytics", "category"],
      ["website analytics", "category"],
      ["data analytics tools", "irrelevant"],
      ["mobile app analytics", "irrelevant"],
      ["product analytics", "irrelevant"],
    ]);
    const card = computeMarketFromLeader("mixpanel.com", mixpanelRows, fathomSeeds, new Map(), [], verdicts)!;
    const keywords = card.phrases.map((p) => p.keyword);
    expect(keywords).toContain("web analytics");
    expect(keywords).toContain("website analytics");
    expect(keywords).not.toContain("data analytics tools"); // judge: irrelevant
    expect(keywords).not.toContain("mobile app analytics"); // judge: irrelevant
    expect(keywords).not.toContain("product analytics"); // judge: irrelevant
    // demand reconciles to the two REAL category phrases only (G4 idiom holds)
    expect(card.demand).toBe(49500 + 22000);
  });

  it("LOCAL fallback: a keyword the judge did NOT rule on still uses token-overlap", () => {
    // "site analytics" has no verdict → falls back to token-overlap (shares
    // "analytics") → kept. A partial judge only refines; it never over-drops.
    const rows = [...mixpanelRows, kw("site analytics", 8, 12000)];
    const verdicts: RelevanceVerdicts = new Map([
      ["web analytics", "category"],
      ["data analytics tools", "irrelevant"],
      ["mobile app analytics", "irrelevant"],
      ["product analytics", "irrelevant"],
      // "website analytics" and "site analytics" intentionally UNJUDGED
    ]);
    const card = computeMarketFromLeader("mixpanel.com", rows, fathomSeeds, new Map(), [], verdicts)!;
    const keywords = card.phrases.map((p) => p.keyword);
    expect(keywords).toContain("web analytics"); // judged category
    expect(keywords).toContain("website analytics"); // unjudged → token-overlap keeps
    expect(keywords).toContain("site analytics"); // unjudged → token-overlap keeps
    expect(keywords).not.toContain("data analytics tools"); // judged irrelevant
  });
});

describe("computeNicheMarket — the niche is sized from REAL data, not one phrase (Phase B-niche)", () => {
  // usefathom (WEB analytics, niche = PRIVACY-first analytics). The old nicheCard
  // priced the single phrase "privacy-first analytics" = 20/mo. The real niche
  // footprint is the privacy/cookieless terms the site actually ranks for.
  const nicheVocab = new Set(["privacy", "cookieless"]); // distinguishing tokens (analytics is category, shared)
  const pool: DemandRow[] = [
    { keyword: "web analytics", volume: 60000, yourPosition: 8 }, // category, NOT niche
    { keyword: "cookieless analytics", volume: 2400, yourPosition: 4 },
    { keyword: "privacy analytics", volume: 1300 },
    { keyword: "privacy-first analytics", volume: 20, yourPosition: 12 }, // the old single phrase
    { keyword: "google analytics alternative", volume: 5400, yourPosition: 6 }, // niche footprint, NO niche token
    { keyword: "google analytics", volume: 900000 }, // mega category term, NOT niche
  ];

  it("WITH judge verdicts: sums the keywords ruled 'niche' (incl. ones with NO niche token), excludes category/irrelevant", () => {
    const verdicts: RelevanceVerdicts = new Map([
      ["web analytics", "category"],
      ["cookieless analytics", "niche"],
      ["privacy analytics", "niche"],
      ["privacy-first analytics", "niche"],
      ["google analytics alternative", "niche"], // judge knows this IS fathom's niche despite no "privacy" token
      ["google analytics", "irrelevant"],
    ]);
    const card = computeNicheMarket("Privacy-First Analytics", pool, nicheVocab, verdicts)!;
    const kws = card.phrases.map((p) => p.keyword);
    expect(kws).toEqual(
      expect.arrayContaining(["cookieless analytics", "privacy analytics", "privacy-first analytics", "google analytics alternative"]),
    );
    expect(kws).not.toContain("web analytics"); // category, not niche
    expect(kws).not.toContain("google analytics"); // judged irrelevant
    // the judge captures the token-less niche term the degrade path would miss:
    expect(card.demand).toBe(5400 + 2400 + 1300 + 20); // credible, not 20
    expect(card.demand).toBeGreaterThan(20);
    expect(card.rankedTop3.length + card.gaps.length).toBe(card.phrases.length);
  });

  it("WITHOUT verdicts (degrade): niche-DISTINGUISHING token gate keeps privacy/cookieless, drops bare 'analytics'", () => {
    const card = computeNicheMarket("Privacy-First Analytics", pool, nicheVocab)!;
    const kws = card.phrases.map((p) => p.keyword);
    expect(kws).toContain("cookieless analytics");
    expect(kws).toContain("privacy analytics");
    expect(kws).not.toContain("web analytics"); // shares only the CATEGORY token
    expect(kws).not.toContain("google analytics");
    expect(kws).not.toContain("google analytics alternative"); // no niche token → degrade MISSES it (only the judge catches it)
  });

  it("returns null when no niche keyword survives (→ degrade to the thin single-phrase card)", () => {
    const catOnly: DemandRow[] = [{ keyword: "web analytics", volume: 60000 }];
    expect(computeNicheMarket("Privacy-First Analytics", catOnly, nicheVocab, new Map([["web analytics", "category"]]))).toBeNull();
    expect(computeNicheMarket("Privacy-First Analytics", [], nicheVocab)).toBeNull();
  });

  it("G4: demand reconciles exactly to the rendered phrases", () => {
    const card = computeNicheMarket("Privacy-First Analytics", pool, nicheVocab)!;
    expect(card.demand).toBe(card.phrases.reduce((s, p) => s + p.volume, 0));
  });
});
