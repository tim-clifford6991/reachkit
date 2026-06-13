/**
 * DiscoverabilityScore visual logic tests.
 *
 * We test the pure helper functions (score label, ring colour, polar-to-cart
 * geometry) that back the SVG rendering — without a DOM or React renderer.
 * These run in vitest node environment.
 */

import { describe, it, expect } from "vitest";
import { verifiedScore } from "@/lib/scan/score-full";

// ---------------------------------------------------------------------------
// Helper duplication for testing (mirrors the private functions in the component)
// ---------------------------------------------------------------------------

function scoreLabel(total: number): string {
  if (total >= 80) return "Excellent";
  if (total >= 60) return "Good";
  if (total >= 40) return "Fair";
  if (total >= 20) return "Needs Work";
  return "Critical";
}

function ringColour(total: number): string {
  if (total >= 70) return "oklch(0.72 0.17 155)";
  if (total >= 40) return "oklch(0.60 0.18 255)";
  return "oklch(0.78 0.18 70)";
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreLabel", () => {
  it("returns Excellent for score >= 80", () => {
    expect(scoreLabel(80)).toBe("Excellent");
    expect(scoreLabel(100)).toBe("Excellent");
  });

  it("returns Good for score 60–79", () => {
    expect(scoreLabel(60)).toBe("Good");
    expect(scoreLabel(79)).toBe("Good");
  });

  it("returns Fair for score 40–59", () => {
    expect(scoreLabel(40)).toBe("Fair");
    expect(scoreLabel(59)).toBe("Fair");
  });

  it("returns Needs Work for score 20–39", () => {
    expect(scoreLabel(20)).toBe("Needs Work");
    expect(scoreLabel(39)).toBe("Needs Work");
  });

  it("returns Critical for score < 20", () => {
    expect(scoreLabel(0)).toBe("Critical");
    expect(scoreLabel(19)).toBe("Critical");
  });
});

describe("ringColour", () => {
  it("returns success green for score >= 70", () => {
    expect(ringColour(70)).toBe("oklch(0.72 0.17 155)");
    expect(ringColour(100)).toBe("oklch(0.72 0.17 155)");
  });

  it("returns accent blue for score 40–69", () => {
    expect(ringColour(40)).toBe("oklch(0.60 0.18 255)");
    expect(ringColour(69)).toBe("oklch(0.60 0.18 255)");
  });

  it("returns warning amber for score < 40", () => {
    expect(ringColour(0)).toBe("oklch(0.78 0.18 70)");
    expect(ringColour(39)).toBe("oklch(0.78 0.18 70)");
  });
});

describe("DiscoverabilityScore integration: VerifiedScore shape", () => {
  it("produces a 7-axis radar from verifiedScore()", () => {
    const score = verifiedScore(
      {
        keywordsRanking: 50,
        directoriesLive: 20,
        comparisonPagesLive: 10,
        asoCoverage: 0,
        contentSurfaces: 5,
        outreachSurfaces: 2,
      },
      "web"
    );

    expect(score.basis).toBe("verified");
    expect(score.radar).toHaveLength(7);

    // 3 active axes
    const active = score.radar.filter((ax) => ax.active);
    expect(active).toHaveLength(3);
    const activeNames = active.map((ax) => ax.axis).sort();
    expect(activeNames).toEqual(["Content", "Outreach", "SEO/ASO"]);

    // 4 locked axes with value 0
    const locked = score.radar.filter((ax) => !ax.active);
    expect(locked).toHaveLength(4);
    for (const ax of locked) {
      expect(ax.value).toBe(0);
    }
  });

  it("total is bounded 0–100", () => {
    const score = verifiedScore(
      {
        keywordsRanking: 100,
        directoriesLive: 100,
        comparisonPagesLive: 100,
        asoCoverage: 100,
        contentSurfaces: 1000,
        outreachSurfaces: 1000,
      },
      "ios"
    );
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.total).toBeGreaterThanOrEqual(0);
  });

  it("zero inputs produce zero total (honest-low first scan)", () => {
    const score = verifiedScore(
      {
        keywordsRanking: 0,
        directoriesLive: 0,
        comparisonPagesLive: 0,
        asoCoverage: 0,
        contentSurfaces: 0,
        outreachSurfaces: 0,
      },
      "web"
    );
    expect(score.total).toBe(0);
    for (const val of Object.values(score.breakdown)) {
      expect(val).toBe(0);
    }
  });

  it("anti-vanity cap keeps self-reported score lower than uncapped", () => {
    const uncapped = verifiedScore(
      {
        keywordsRanking: 60,
        directoriesLive: 50,
        comparisonPagesLive: 50,
        asoCoverage: 0,
        contentSurfaces: 20,
        outreachSurfaces: 10,
      },
      "web"
    );
    const capped = verifiedScore(
      {
        keywordsRanking: 60,
        directoriesLive: 50,
        comparisonPagesLive: 50,
        asoCoverage: 0,
        contentSurfaces: 20,
        outreachSurfaces: 10,
        selfReportedFraction: { content: 0.8, outreach: 0.8, seo: 0.5 },
      },
      "web"
    );
    // Capped score must be <= uncapped when significant self-reporting
    expect(capped.total).toBeLessThanOrEqual(uncapped.total);
  });
});
