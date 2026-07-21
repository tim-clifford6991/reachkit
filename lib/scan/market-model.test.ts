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
import { pickCategoryLeader, computeMarketFromLeader } from "./search-visibility";
import type { RankedKeyword } from "./adapters/dataforseo-ranked-keywords";
import type { CategoryNicheSeeds } from "@/lib/llm/types";

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
