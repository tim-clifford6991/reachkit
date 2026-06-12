import { describe, expect, test } from "vitest";
import { discoverabilityScore } from "./score";
import type { PreliminaryFacts } from "./types";
import type { KeywordSheet } from "@/lib/llm/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const BASE_FACTS: PreliminaryFacts = {
  mode: "ios",
  listing: { name: "TestApp", category: "Productivity", description: "A test app" },
  competitors: [],
  reviewVolume: 0,
  ratingTrend: null,
  webProxy: null,
  themes: [],
  sourcesUsed: [],
};

const SMALL_KEYWORDS: KeywordSheet = {
  clusters: [
    { theme: "Habit tracking", keywords: [{ keyword: "habit tracker", volume: 500 }] },
  ],
};

const LARGE_KEYWORDS: KeywordSheet = {
  clusters: [
    {
      theme: "Habit tracking",
      keywords: [
        { keyword: "habit tracker app", volume: 8100 },
        { keyword: "daily habit tracker", volume: 5400 },
      ],
    },
    {
      theme: "Productivity",
      keywords: [
        { keyword: "productivity app", volume: 4400 },
        { keyword: "daily routine app", volume: 2900 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Clamp: subscore 0–100, total 0–100
// ---------------------------------------------------------------------------
describe("discoverabilityScore — clamp invariant", () => {
  test("minimum facts produce non-negative scores", () => {
    const result = discoverabilityScore(BASE_FACTS, null);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.breakdown.content).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.content).toBeLessThanOrEqual(100);
    expect(result.breakdown.outreach).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.outreach).toBeLessThanOrEqual(100);
    expect(result.breakdown.seo).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.seo).toBeLessThanOrEqual(100);
  });

  test("total is always an integer (Math.round)", () => {
    const result = discoverabilityScore(
      { ...BASE_FACTS, reviewVolume: 123, themes: [{ term: "a", count: 1 }, { term: "b", count: 2 }] },
      SMALL_KEYWORDS,
    );
    expect(Number.isInteger(result.total)).toBe(true);
  });

  test("total matches weighted formula within rounding", () => {
    const result = discoverabilityScore(
      { ...BASE_FACTS, reviewVolume: 500 },
      LARGE_KEYWORDS,
    );
    const { content, outreach, seo } = result.breakdown;
    const expected = Math.round(0.30 * content + 0.25 * outreach + 0.45 * seo);
    expect(result.total).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Monotonicity: more signals ⇒ higher subscores
// ---------------------------------------------------------------------------
describe("discoverabilityScore — content subscore monotonicity", () => {
  test("more reviews raises content score", () => {
    const low = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 10 }, null);
    const high = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 10_000 }, null);
    expect(high.breakdown.content).toBeGreaterThan(low.breakdown.content);
  });

  test("more themes raises content score", () => {
    const low = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 100, themes: [] }, null);
    const high = discoverabilityScore({
      ...BASE_FACTS,
      reviewVolume: 100,
      themes: [
        { term: "a", count: 5 },
        { term: "b", count: 3 },
        { term: "c", count: 2 },
        { term: "d", count: 1 },
        { term: "e", count: 1 },
      ],
    }, null);
    expect(high.breakdown.content).toBeGreaterThan(low.breakdown.content);
  });
});

describe("discoverabilityScore — outreach subscore", () => {
  test("app mode: more reviews produces higher outreach (conservative baseline)", () => {
    const low = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 50 }, null);
    const high = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 5000 }, null);
    expect(high.breakdown.outreach).toBeGreaterThanOrEqual(low.breakdown.outreach);
  });

  test("web mode: higher phUpvotes raises outreach", () => {
    const low = discoverabilityScore({
      ...BASE_FACTS,
      mode: "web",
      ratingTrend: null,
      webProxy: { score: 20, serpResultCount: 0, phUpvotes: 0, domainAgeYears: null },
    }, null);
    const high = discoverabilityScore({
      ...BASE_FACTS,
      mode: "web",
      ratingTrend: null,
      webProxy: { score: 50, serpResultCount: 0, phUpvotes: 1200, domainAgeYears: null },
    }, null);
    expect(high.breakdown.outreach).toBeGreaterThan(low.breakdown.outreach);
  });

  test("outreach is conservative (≤40 for typical Cycle 2 signals)", () => {
    const result = discoverabilityScore({ ...BASE_FACTS, reviewVolume: 500 }, LARGE_KEYWORDS);
    expect(result.breakdown.outreach).toBeLessThanOrEqual(40);
  });
});

describe("discoverabilityScore — SEO subscore monotonicity", () => {
  test("more keyword volume raises seo score", () => {
    const low = discoverabilityScore(BASE_FACTS, SMALL_KEYWORDS);
    const high = discoverabilityScore(BASE_FACTS, LARGE_KEYWORDS);
    expect(high.breakdown.seo).toBeGreaterThan(low.breakdown.seo);
  });

  test("more competitors raises seo score (competitive gap pressure)", () => {
    const fewCompetitors: PreliminaryFacts = {
      ...BASE_FACTS,
      competitors: [{ name: "A", url: "https://a.com", source: "x", rank: 1 }],
    };
    const manyCompetitors: PreliminaryFacts = {
      ...BASE_FACTS,
      competitors: [
        { name: "A", url: "https://a.com", source: "x", rank: 1 },
        { name: "B", url: "https://b.com", source: "x", rank: 2 },
        { name: "C", url: "https://c.com", source: "x", rank: 3 },
        { name: "D", url: "https://d.com", source: "x", rank: 4 },
      ],
    };
    const low = discoverabilityScore(fewCompetitors, SMALL_KEYWORDS);
    const high = discoverabilityScore(manyCompetitors, SMALL_KEYWORDS);
    expect(high.breakdown.seo).toBeGreaterThanOrEqual(low.breakdown.seo);
  });

  test("null keywords handled gracefully (seo score still non-negative)", () => {
    const result = discoverabilityScore(BASE_FACTS, null);
    expect(result.breakdown.seo).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.seo).toBeLessThanOrEqual(100);
  });
});
