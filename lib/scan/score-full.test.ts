/**
 * Tests for the verified Discoverability Score + radar (§7 anti-vanity rules).
 * TDD: tests written before implementation.
 */
import { describe, expect, test } from "vitest";
import { verifiedScore, gatherScoreComponents } from "./score-full";
import type { ScoreComponents } from "./score-full";
import type { PreliminaryFacts } from "./types";
import type { ScanContext } from "./pipeline";
import { ScanBudget } from "@/lib/tools/registry";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_COMPONENTS: ScoreComponents = {
  keywordsRanking: 60,
  directoriesLive: 50,
  comparisonPagesLive: 40,
  asoCoverage: 80,
  contentSurfaces: 5,
  outreachSurfaces: 3,
};

const ZERO_COMPONENTS: ScoreComponents = {
  keywordsRanking: 0,
  directoriesLive: 0,
  comparisonPagesLive: 0,
  asoCoverage: 0,
  contentSurfaces: 0,
  outreachSurfaces: 0,
};

const BASE_FACTS: PreliminaryFacts = {
  mode: "ios",
  listing: { name: "TestApp", category: "Productivity", description: "A test app" },
  competitors: [
    { name: "CompA", url: "https://compa.com", source: "test", rank: 1 },
    { name: "CompB", url: "https://compb.com", source: "test", rank: 2 },
  ],
  reviewVolume: 100,
  ratingTrend: 4.2,
  webProxy: null,
  themes: [{ term: "speed", count: 5 }],
  sourcesUsed: ["itunes"],
  coldStart: false,
};

function makeCtx(mode: "ios" | "android" | "web" = "ios"): ScanContext {
  return {
    scanId: "scan-test-1",
    appId: "123",
    storeUrl: mode === "web" ? "https://example.com" : "https://apps.apple.com/us/app/test/id123",
    mode,
    budget: new ScanBudget({ maxToolCalls: 100, budgetCents: 10_000 }),
  };
}

// ---------------------------------------------------------------------------
// SEO/ASO weighting: app mode
// ---------------------------------------------------------------------------
describe("verifiedScore — SEO/ASO subscore (app mode)", () => {
  test("app mode uses 4-way weighting: 0.40 kw + 0.20 dir + 0.20 cmp + 0.20 aso", () => {
    const components: ScoreComponents = {
      keywordsRanking: 100,
      directoriesLive: 0,
      comparisonPagesLive: 0,
      asoCoverage: 0,
      contentSurfaces: 0,
      outreachSurfaces: 0,
    };
    const result = verifiedScore(components, "ios");
    // seo = 100*0.40 + 0*0.20 + 0*0.20 + 0*0.20 = 40
    expect(result.breakdown.seo).toBe(40);
  });

  test("app mode: all seo inputs at 100 gives seo = 100", () => {
    const components: ScoreComponents = {
      keywordsRanking: 100,
      directoriesLive: 100,
      comparisonPagesLive: 100,
      asoCoverage: 100,
      contentSurfaces: 0,
      outreachSurfaces: 0,
    };
    const result = verifiedScore(components, "android");
    expect(result.breakdown.seo).toBe(100);
  });

  test("app mode asoCoverage contributes 0.20 weight", () => {
    const withAso: ScoreComponents = {
      keywordsRanking: 50,
      directoriesLive: 50,
      comparisonPagesLive: 50,
      asoCoverage: 100,
      contentSurfaces: 0,
      outreachSurfaces: 0,
    };
    const withoutAso: ScoreComponents = {
      ...withAso,
      asoCoverage: 0,
    };
    const high = verifiedScore(withAso, "ios");
    const low = verifiedScore(withoutAso, "ios");
    // diff = 100*0.20 - 0*0.20 = 20
    expect(high.breakdown.seo - low.breakdown.seo).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// SEO/ASO weighting: web mode (no ASO — redistributes 20% to kw and dir/cmp)
// ---------------------------------------------------------------------------
describe("verifiedScore — SEO/ASO subscore (web mode)", () => {
  test("web mode uses 3-way weighting: 0.50 kw + 0.25 dir + 0.25 cmp", () => {
    const components: ScoreComponents = {
      keywordsRanking: 100,
      directoriesLive: 0,
      comparisonPagesLive: 0,
      asoCoverage: 100, // ignored in web mode
      contentSurfaces: 0,
      outreachSurfaces: 0,
    };
    const result = verifiedScore(components, "web");
    // seo = 100*0.50 + 0*0.25 + 0*0.25 = 50 (asoCoverage is ignored)
    expect(result.breakdown.seo).toBe(50);
  });

  test("web mode: all seo inputs at 100 gives seo = 100 (asoCoverage irrelevant)", () => {
    const components: ScoreComponents = {
      keywordsRanking: 100,
      directoriesLive: 100,
      comparisonPagesLive: 100,
      asoCoverage: 0, // irrelevant for web
      contentSurfaces: 0,
      outreachSurfaces: 0,
    };
    const result = verifiedScore(components, "web");
    expect(result.breakdown.seo).toBe(100);
  });

  test("web mode redistributes ASO 20% correctly: kw gets 0.50 not 0.40", () => {
    const appResult = verifiedScore({ ...ZERO_COMPONENTS, keywordsRanking: 100 }, "ios");
    const webResult = verifiedScore({ ...ZERO_COMPONENTS, keywordsRanking: 100 }, "web");
    // app: 100*0.40 = 40; web: 100*0.50 = 50
    expect(appResult.breakdown.seo).toBe(40);
    expect(webResult.breakdown.seo).toBe(50);
  });

  test("web mode: directoriesLive and comparisonPagesLive each weight 0.25", () => {
    const dirOnly = verifiedScore({ ...ZERO_COMPONENTS, directoriesLive: 100 }, "web");
    const cmpOnly = verifiedScore({ ...ZERO_COMPONENTS, comparisonPagesLive: 100 }, "web");
    expect(dirOnly.breakdown.seo).toBe(25);
    expect(cmpOnly.breakdown.seo).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// Anti-vanity cap: self-reported fraction capped at 20% of subscore
// ---------------------------------------------------------------------------
describe("verifiedScore — anti-vanity cap (§7.2 rule 1)", () => {
  test("no selfReportedFraction: no cap applied, full score passes through", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    // Just ensure it doesn't error and score is positive
    expect(result.breakdown.content).toBeGreaterThan(0);
    expect(result.breakdown.outreach).toBeGreaterThan(0);
  });

  test("100% self-reported content: contribution capped to 20% of raw subscore", () => {
    // Content subscore raw from contentSurfaces=50 (log scaled)
    const components: ScoreComponents = {
      ...ZERO_COMPONENTS,
      contentSurfaces: 50,
      selfReportedFraction: { content: 1.0 }, // 100% self-reported
    };
    const uncapped = verifiedScore({ ...ZERO_COMPONENTS, contentSurfaces: 50 }, "ios");
    const capped = verifiedScore(components, "ios");
    // With 100% self-reported, the self portion is clamped to 20% of raw.
    // So: rawContent - (rawContent - 0.20*rawContent) = 0.20*rawContent
    expect(capped.breakdown.content).toBe(Math.round(0.20 * uncapped.breakdown.content));
  });

  test("50% self-reported, fraction > 20% threshold: cap kicks in", () => {
    // If 50% of subscore is self-reported but cap is 20%,
    // the self portion is clamped to 20%.
    // verified = rawScore - selfPortion + min(selfPortion, 0.20*rawScore)
    const components: ScoreComponents = {
      ...ZERO_COMPONENTS,
      contentSurfaces: 100,
      selfReportedFraction: { content: 0.5 },
    };
    const uncapped = verifiedScore({ ...ZERO_COMPONENTS, contentSurfaces: 100 }, "ios");
    const capped = verifiedScore(components, "ios");
    // selfPortion = 0.5 * uncapped.content
    // allowed = min(selfPortion, 0.20 * uncapped.content) = 0.20 * uncapped.content
    // verified = uncapped.content - selfPortion + allowed = uncapped.content - 0.30*uncapped.content
    const expected = Math.round(uncapped.breakdown.content * 0.70);
    expect(capped.breakdown.content).toBe(expected);
  });

  test("20% or less self-reported: cap does not reduce score", () => {
    const components: ScoreComponents = {
      ...ZERO_COMPONENTS,
      outreachSurfaces: 10,
      selfReportedFraction: { outreach: 0.20 }, // exactly at the cap — no reduction
    };
    const baseline = verifiedScore({ ...ZERO_COMPONENTS, outreachSurfaces: 10 }, "ios");
    const capped = verifiedScore(components, "ios");
    // self = 0.20 * raw; allowed = min(0.20*raw, 0.20*raw) — no reduction
    expect(capped.breakdown.outreach).toBe(baseline.breakdown.outreach);
  });

  test("10% self-reported: no cap, score unchanged", () => {
    const components: ScoreComponents = {
      ...ZERO_COMPONENTS,
      outreachSurfaces: 10,
      selfReportedFraction: { outreach: 0.10 },
    };
    const baseline = verifiedScore({ ...ZERO_COMPONENTS, outreachSurfaces: 10 }, "ios");
    const withSelf = verifiedScore(components, "ios");
    expect(withSelf.breakdown.outreach).toBe(baseline.breakdown.outreach);
  });

  test("SEO self-reported fraction also capped", () => {
    const components: ScoreComponents = {
      ...ZERO_COMPONENTS,
      keywordsRanking: 80,
      selfReportedFraction: { seo: 1.0 },
    };
    const uncapped = verifiedScore({ ...ZERO_COMPONENTS, keywordsRanking: 80 }, "ios");
    const capped = verifiedScore(components, "ios");
    expect(capped.breakdown.seo).toBe(Math.round(0.20 * uncapped.breakdown.seo));
  });
});

// ---------------------------------------------------------------------------
// Total weighting: .30 content + .25 outreach + .45 seo, clamped, integer
// ---------------------------------------------------------------------------
describe("verifiedScore — total score formula", () => {
  test("total matches 0.30*content + 0.25*outreach + 0.45*seo (rounded)", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    const { content, outreach, seo } = result.breakdown;
    const expected = Math.round(
      Math.min(100, Math.max(0, 0.30 * content + 0.25 * outreach + 0.45 * seo)),
    );
    expect(result.total).toBe(expected);
  });

  test("total is always an integer", () => {
    const result = verifiedScore(BASE_COMPONENTS, "web");
    expect(Number.isInteger(result.total)).toBe(true);
  });

  test("total is clamped to [0, 100]", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  test("all-zero components produce total = 0", () => {
    const result = verifiedScore(ZERO_COMPONENTS, "ios");
    expect(result.total).toBe(0);
    expect(result.breakdown.content).toBe(0);
    expect(result.breakdown.outreach).toBe(0);
    expect(result.breakdown.seo).toBe(0);
  });

  test("all max components produce total = 100", () => {
    const maxComponents: ScoreComponents = {
      keywordsRanking: 100,
      directoriesLive: 100,
      comparisonPagesLive: 100,
      asoCoverage: 100,
      contentSurfaces: 1e9, // very large → log scale ≈ 100
      outreachSurfaces: 1e9,
    };
    const result = verifiedScore(maxComponents, "ios");
    expect(result.total).toBe(100);
  });

  test("subscores are rounded integers", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    expect(Number.isInteger(result.breakdown.content)).toBe(true);
    expect(Number.isInteger(result.breakdown.outreach)).toBe(true);
    expect(Number.isInteger(result.breakdown.seo)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Radar: 3 active axes + 4 locked
// ---------------------------------------------------------------------------
describe("verifiedScore — radar", () => {
  test("radar has exactly 7 axes", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    expect(result.radar).toHaveLength(7);
  });

  test("3 active axes: Content, Outreach, SEO/ASO", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    const active = result.radar.filter((a) => a.active);
    expect(active).toHaveLength(3);
    const activeNames = active.map((a) => a.axis).sort();
    expect(activeNames).toEqual(["Content", "Outreach", "SEO/ASO"].sort());
  });

  test("4 locked axes: Ads, Partnerships, PR, Positioning (value 0, active false)", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    const locked = result.radar.filter((a) => !a.active);
    expect(locked).toHaveLength(4);
    const lockedNames = locked.map((a) => a.axis).sort();
    expect(lockedNames).toEqual(["Ads", "Partnerships", "Positioning", "PR"].sort());
    for (const axis of locked) {
      expect(axis.value).toBe(0);
    }
  });

  test("active axes have values matching their subscores", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    const byAxis = Object.fromEntries(result.radar.map((a) => [a.axis, a]));
    expect(byAxis["Content"]?.value).toBe(result.breakdown.content);
    expect(byAxis["Outreach"]?.value).toBe(result.breakdown.outreach);
    expect(byAxis["SEO/ASO"]?.value).toBe(result.breakdown.seo);
  });

  test("radar values are in [0, 100]", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    for (const axis of result.radar) {
      expect(axis.value).toBeGreaterThanOrEqual(0);
      expect(axis.value).toBeLessThanOrEqual(100);
    }
  });
});

// ---------------------------------------------------------------------------
// basis: "verified"
// ---------------------------------------------------------------------------
describe("verifiedScore — basis field", () => {
  test('basis is always "verified"', () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    expect(result.basis).toBe("verified");
  });
});

// ---------------------------------------------------------------------------
// gatherScoreComponents: honest-low first scan
// ---------------------------------------------------------------------------
describe("gatherScoreComponents — first scan (Cycle 3)", () => {
  test("directoriesLive = 0 at first scan", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.directoriesLive).toBe(0);
  });

  test("comparisonPagesLive = 0 at first scan", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.comparisonPagesLive).toBe(0);
  });

  test("contentSurfaces = 0 at first scan", async () => {
    const ctx = makeCtx("web");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "web", webProxy: { score: 40, serpResultCount: 10, phUpvotes: 5, domainAgeYears: 2 }, ratingTrend: null };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.contentSurfaces).toBe(0);
  });

  test("outreachSurfaces = 0 at first scan", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.outreachSurfaces).toBe(0);
  });

  test("keywordsRanking is non-negative and within [0, 100]", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.keywordsRanking).toBeGreaterThanOrEqual(0);
    expect(components.keywordsRanking).toBeLessThanOrEqual(100);
  });

  test("asoCoverage is non-negative and within [0, 100]", async () => {
    const ctx = makeCtx("android");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "android" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.asoCoverage).toBeGreaterThanOrEqual(0);
    expect(components.asoCoverage).toBeLessThanOrEqual(100);
  });

  test("web mode: asoCoverage is 0 (not applicable)", async () => {
    const ctx = makeCtx("web");
    const facts: PreliminaryFacts = {
      ...BASE_FACTS,
      mode: "web",
      webProxy: { score: 40, serpResultCount: 10, phUpvotes: 5, domainAgeYears: 2 },
      ratingTrend: null,
    };
    const components = await gatherScoreComponents(ctx, facts);
    expect(components.asoCoverage).toBe(0);
  });

  test("first scan produces low total (honest low score reflects nothing executed)", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    const result = verifiedScore(components, ctx.mode);
    // First scan: content=0, outreach=0, seo=low (only keyword ranking estimate)
    // Total must be low — reflect that no surfaces have been built yet
    expect(result.total).toBeLessThan(50);
  });

  test("gatherScoreComponents returns valid ScoreComponents shape", async () => {
    const ctx = makeCtx("ios");
    const facts: PreliminaryFacts = { ...BASE_FACTS, mode: "ios" };
    const components = await gatherScoreComponents(ctx, facts);
    expect(typeof components.keywordsRanking).toBe("number");
    expect(typeof components.directoriesLive).toBe("number");
    expect(typeof components.comparisonPagesLive).toBe("number");
    expect(typeof components.asoCoverage).toBe("number");
    expect(typeof components.contentSurfaces).toBe("number");
    expect(typeof components.outreachSurfaces).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// M3: assessed axes — don't score un-measured surfaces as 0 (the "Stripe = 19" fix)
// ---------------------------------------------------------------------------
describe("verifiedScore — assessed axes (credible score)", () => {
  test("first scan (no content/outreach surfaces): total === seo, those axes NOT assessed", () => {
    // keywordsRanking 84 → web seo = 84*0.50 = 42. Old formula dragged this to ~19.
    const result = verifiedScore({ ...ZERO_COMPONENTS, keywordsRanking: 84 }, "web");
    expect(result.breakdown.seo).toBe(42);
    expect(result.total).toBe(42); // assessed-only: not penalised by un-measured content/outreach
    const byAxis = Object.fromEntries(result.radar.map((a) => [a.axis, a]));
    expect(byAxis["SEO/ASO"]?.assessed).toBe(true);
    expect(byAxis["Content"]?.assessed).toBe(false);
    expect(byAxis["Outreach"]?.assessed).toBe(false);
  });

  test("with verified content + outreach surfaces: all assessed, total blends all three", () => {
    const result = verifiedScore(
      { ...ZERO_COMPONENTS, keywordsRanking: 80, contentSurfaces: 50, outreachSurfaces: 30 },
      "web",
    );
    const byAxis = Object.fromEntries(result.radar.map((a) => [a.axis, a]));
    expect(byAxis["Content"]?.assessed).toBe(true);
    expect(byAxis["Outreach"]?.assessed).toBe(true);
    const { content, outreach, seo } = result.breakdown;
    expect(result.total).toBe(Math.round(0.3 * content + 0.25 * outreach + 0.45 * seo));
  });

  test("locked axes are never assessed", () => {
    const result = verifiedScore(BASE_COMPONENTS, "ios");
    for (const ax of result.radar.filter((a) => !a.active)) {
      expect(ax.assessed).toBe(false);
    }
  });
});
