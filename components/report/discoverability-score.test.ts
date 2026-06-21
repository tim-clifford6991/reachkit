/**
 * DiscoverabilityScore integration tests.
 *
 * The band label + ring colour now come from lib/scan/score-bands (tested in
 * score-bands.test.ts). This file keeps the VerifiedScore-shape integration.
 */

import { describe, it, expect } from "vitest";
import { verifiedScore } from "@/lib/scan/score-full";

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
