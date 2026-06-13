/**
 * Unit tests for lib/badge/score-card.ts
 *
 * Tests the pure buildScoreCard and buildCaption functions independently of
 * any rendering. Matches the vitest node environment used by existing test
 * files (discoverability-score.test.ts, report-sections.test.ts).
 */

import { describe, it, expect } from "vitest";
import { buildScoreCard, buildCaption } from "./score-card";
import type { ReportPayload } from "@/lib/scan/report";

// ---------------------------------------------------------------------------
// Test fixture factory
// ---------------------------------------------------------------------------

function makePayload(total: number): ReportPayload {
  const breakdown = { content: Math.round(total * 0.3), outreach: Math.round(total * 0.25), seo: Math.round(total * 0.45) };
  return {
    mode: "web",
    generatedAt: "2026-06-13T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: {
        listingSays: "An analytics tool",
        reviewsValue: "Time savings",
        gap: "Language mismatch",
      },
    },
    whoItsFor: { summary: "Solo founders", signals: ["speed", "simplicity"] },
    whereTheyAre: { surfaces: [], competitorGap: [] },
    whatToDoThisWeek: { quickWins: [], medium: [], longPlay: [] },
    score: {
      total,
      breakdown,
      basis: "verified",
      radar: [
        { axis: "Content",      value: breakdown.content,  active: true  },
        { axis: "Outreach",     value: breakdown.outreach, active: true  },
        { axis: "SEO/ASO",      value: breakdown.seo,      active: true  },
        { axis: "Ads",          value: 0,                  active: false },
        { axis: "Partnerships", value: 0,                  active: false },
        { axis: "PR",           value: 0,                  active: false },
        { axis: "Positioning",  value: 0,                  active: false },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// buildCaption
// ---------------------------------------------------------------------------

describe("buildCaption", () => {
  it("returns 'Strong' caption for score >= 80", () => {
    expect(buildCaption(80)).toContain("Strong");
    expect(buildCaption(100)).toContain("Strong");
    expect(buildCaption(80)).toContain("verified, not vanity");
  });

  it("returns 'Solid' caption for score 60–79", () => {
    expect(buildCaption(60)).toContain("Solid");
    expect(buildCaption(79)).toContain("Solid");
    expect(buildCaption(60)).toContain("verified, not vanity");
  });

  it("returns gap-identified caption for score 40–59", () => {
    const c = buildCaption(40);
    expect(c).toContain("gaps identified");
    expect(c).toContain("verified not vanity");
    expect(buildCaption(59)).toContain("gaps identified");
  });

  it("returns early-stage caption for score 20–39", () => {
    expect(buildCaption(20)).toContain("Early-stage");
    expect(buildCaption(39)).toContain("Early-stage");
    expect(buildCaption(20)).toContain("verified, not vanity");
  });

  it("returns verified baseline caption for score < 20", () => {
    expect(buildCaption(0)).toContain("verified baseline");
    expect(buildCaption(19)).toContain("verified baseline");
    expect(buildCaption(0)).toContain("not vanity");
  });

  it("never contains inflated claims like 'top performer'", () => {
    for (const score of [0, 25, 50, 75, 100]) {
      const c = buildCaption(score);
      expect(c).not.toMatch(/top performer|high achiever|best in class|outstanding/i);
    }
  });
});

// ---------------------------------------------------------------------------
// buildScoreCard
// ---------------------------------------------------------------------------

describe("buildScoreCard", () => {
  it("sets total from payload.score.total", () => {
    const card = buildScoreCard(makePayload(63));
    expect(card.total).toBe(63);
  });

  it("copies breakdown from payload.score.breakdown", () => {
    const payload = makePayload(63);
    const card = buildScoreCard(payload);
    expect(card.breakdown).toEqual(payload.score.breakdown);
  });

  it("filters radarSummary to only active axes", () => {
    const card = buildScoreCard(makePayload(50));
    expect(card.radarSummary).toHaveLength(3);
    for (const bar of card.radarSummary) {
      expect(bar.active).toBe(true);
    }
  });

  it("includes Content, Outreach, SEO/ASO in radarSummary", () => {
    const card = buildScoreCard(makePayload(50));
    const labels = card.radarSummary.map((b) => b.label);
    expect(labels).toContain("Content");
    expect(labels).toContain("Outreach");
    expect(labels).toContain("SEO/ASO");
  });

  it("excludes locked axes from radarSummary", () => {
    const card = buildScoreCard(makePayload(50));
    const labels = card.radarSummary.map((b) => b.label);
    expect(labels).not.toContain("Ads");
    expect(labels).not.toContain("Partnerships");
    expect(labels).not.toContain("PR");
    expect(labels).not.toContain("Positioning");
  });

  it("sets productName to ReachKit", () => {
    const card = buildScoreCard(makePayload(40));
    expect(card.productName).toBe("ReachKit");
  });

  it("sets caption using buildCaption (tier-appropriate)", () => {
    const card = buildScoreCard(makePayload(85));
    expect(card.caption).toContain("Strong");
    expect(card.caption).toContain("verified, not vanity");
  });

  it("handles zero-score payload (honest-low first scan)", () => {
    const card = buildScoreCard(makePayload(0));
    expect(card.total).toBe(0);
    expect(card.caption).toContain("not vanity");
    expect(card.radarSummary).toHaveLength(3);
    for (const bar of card.radarSummary) {
      expect(bar.value).toBe(0);
    }
  });

  it("handles 100-score payload without vanity language", () => {
    const card = buildScoreCard(makePayload(100));
    expect(card.total).toBe(100);
    expect(card.caption).not.toMatch(/top performer|outstanding|best in class/i);
  });
});
