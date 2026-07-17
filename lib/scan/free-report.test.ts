import { describe, it, expect } from "vitest";
import { verifiedScoreFromRegistry, buildFreeReport } from "./free-report";
import type { RegistryScore } from "./registry-score";
import type { PreliminaryFacts } from "./types";

const REG: RegistryScore = { total: 62, breakdown: { content: 55, outreach: 0, seo: 68 }, assessed: ["content", "seo"] };

const FACTS: PreliminaryFacts = {
  mode: "web",
  listing: { name: "Acme", category: "SaaS", description: "d" },
  reviewVolume: 12,
  competitors: [{ rank: 1, name: "Rival A", source: "serp" }],
  themes: [{ term: "fast onboarding", count: 4 }],
  coldStart: false,
} as unknown as PreliminaryFacts;

describe("verifiedScoreFromRegistry", () => {
  it("wraps a RegistryScore into a VerifiedScore with a 7-axis radar (3 active + 4 locked)", () => {
    const s = verifiedScoreFromRegistry(REG);
    expect(s.total).toBe(62);
    expect(s.breakdown).toEqual({ content: 55, outreach: 0, seo: 68 });
    expect(s.basis).toBe("verified");
    expect(s.radar).toHaveLength(7);

    const active = s.radar.filter((a) => a.active);
    expect(active.map((a) => a.axis).sort()).toEqual(["Content", "Outreach", "SEO/ASO"]);

    const locked = s.radar.filter((a) => !a.active);
    expect(locked.map((a) => a.axis).sort()).toEqual(["Ads", "PR", "Partnerships", "Positioning"]);
    for (const l of locked) {
      expect(l.value).toBe(0);
      expect(l.assessed).toBe(false);
    }

    // Outreach is not assessed on the fixed basis → axis marked unassessed.
    expect(s.radar.find((a) => a.axis === "Outreach")!.assessed).toBe(false);
    expect(s.radar.find((a) => a.axis === "SEO/ASO")!.assessed).toBe(true);
  });
});

describe("buildFreeReport", () => {
  const report = buildFreeReport({
    mode: "web",
    generatedAt: "2026-07-07T00:00:00.000Z",
    facts: FACTS,
    positioningMirror: { listingSays: "l", reviewsValue: "r", gap: "g" },
    findings: [{ category: "seo", claim: "thin copy", basis: "site", confidence: 0.7, evidence: [] } as never],
    actions: [],
    score: verifiedScoreFromRegistry(REG),
  });

  it("produces a valid ReportPayload with the score and empty deep sections", () => {
    expect(report.score.total).toBe(62);
    expect(report.mode).toBe("web");
    expect(report.whatYouOffer.positioningMirror.gap).toBe("g");
    // Deep sections are empty on a free report.
    expect(report.competitiveLandscape).toEqual([]);
    expect(report.channelOpportunities).toEqual({ keywordClusters: [], communitiesByEngagement: [] });
    expect(report.creatorsToReach).toEqual([]);
  });

  it("derives icpSignals from facts.themes and competitorGap from facts.competitors", () => {
    expect(report.whoItsFor.signals).toContain("fast onboarding");
    expect(report.whereTheyAre.competitorGap.map((g) => g.competitor)).toContain("Rival A");
  });
});

// Regression guard (Phase 4 / C-WS3): runFreeReport used to emit ZERO scan events,
// so the free scan went silent through its final stage AND never emitted a `report`
// event — the funnel's reportReady handoff (handoff.ts) then stalled on the live
// view until the `done` step boundary, despite report_payload already being
// persisted. It must emit progress (the footprint artifact) and the `report` event.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expectCallsSymbol } from "@/lib/testing/tripwire";

describe("free report progress (ratchet)", () => {
  it("runFreeReport emits scan events — never silent again", () => {
    expect(() => expectCallsSymbol("lib/scan/free-report.ts", "emitScanEvent", { within: "runFreeReport" })).not.toThrow();
  });

  it("runFreeReport emits a `report` event so the funnel hands off at report, not `done`", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/scan/free-report.ts"), "utf8");
    // The report-event emission is the load-bearing handoff trigger for free scans.
    expect(src).toMatch(/emitScanEvent\([^)]*"report"/);
  });
});
