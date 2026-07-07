/**
 * public-report.test.tsx — the public /scan/[id] result is ALWAYS free-redacted,
 * regardless of any viewer/auth state (there is none passed in — the module
 * never imports currentUser/entitlementsFor). Exercises the pure
 * `publicReportProps` helper since a server component is awkward to render
 * in vitest.
 */

import { describe, it, expect } from "vitest";
import { publicReportProps } from "./public-report";
import { redactReportForTier } from "@/lib/billing/entitlements";
import { buildScoreCard } from "@/lib/badge/score-card";
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";

function action(title: string, delta: number, effortMin = 20): ActionCard {
  return {
    category: "content",
    title,
    why: `why ${title}`,
    evidenceIds: [],
    evidence: [],
    effortMin,
    suggestedDeadline: "2026-07-17",
    expectedOutcome: { scoreComponent: "content", delta },
    draft: "a paid draft that must never leak publicly",
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "probability_based",
    confidence: 0.5,
    target: null,
  };
}

function report(overrides: Partial<ReportPayload> = {}): ReportPayload {
  return {
    mode: "web",
    generatedAt: "2026-07-03T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: { listingSays: "Photo tools, for creators", reviewsValue: "fast galleries", gap: "gap text" },
    },
    whoItsFor: { summary: "s", signals: ["speed"] },
    whereTheyAre: { surfaces: [], competitorGap: [] },
    whatToDoThisWeek: { quickWins: [], medium: [], longPlay: [] },
    score: {
      total: 42,
      breakdown: { content: 40, outreach: 30, seo: 50 },
      radar: [],
      basis: "verified",
    },
    ...overrides,
  };
}

describe("publicReportProps — always free-redacted", () => {
  it("redacts to tier 'free' even though no viewer is passed in", () => {
    const payload = report({
      whatToDoThisWeek: {
        quickWins: [action("a", 2), action("b", 9)],
        medium: [action("c", 5, 60)],
        longPlay: [action("d", 7, 200)],
      },
    });
    const { report: redacted } = publicReportProps(payload, "bloom-io", "https://bloom.io");
    expect(redacted).toEqual(redactReportForTier(payload, "free"));
  });

  it("empties paid drafts on the returned report (free-redacted, no leak)", () => {
    const payload = report({
      whatToDoThisWeek: { quickWins: [action("a", 2)], medium: [], longPlay: [] },
    });
    const { report: redacted } = publicReportProps(payload, "bloom-io", "https://bloom.io");
    const allActions = [
      ...redacted.whatToDoThisWeek.quickWins,
      ...redacted.whatToDoThisWeek.medium,
      ...redacted.whatToDoThisWeek.longPlay,
    ];
    expect(allActions.length).toBeGreaterThan(0);
    for (const a of allActions) {
      expect(a.draft).toBeNull();
    }
  });

  it("carries pre-redaction totals so the locked-count teaser reflects the withheld total", () => {
    const kg = [
      { keyword: "photo gallery website", volume: 4400, cpc: 1, competition: 0.2 },
      { keyword: "portfolio builder", volume: 900, cpc: 1, competition: 0.2 },
    ];
    const payload = report({
      whatToDoThisWeek: {
        quickWins: [action("a", 2), action("b", 9), action("c", 4), action("d", 1)],
        medium: [],
        longPlay: [],
      },
      market: {
        cohort: { self: {}, competitors: [], competitorDomains: [] },
        demand: { pockets: [] },
        gap: { channelGaps: [], keywordGap: kg, demandPockets: [] },
        plan: { items: [] },
      } as unknown as ReportPayload["market"],
    });

    const { resultsProps } = publicReportProps(payload, "bloom-io", "https://bloom.io");

    // Full payload has 4 actions; the free redactor caps the preview, so the
    // teaser's fullTotal (used to derive lockedCount) must reflect all 4, not
    // just the redacted preview count.
    expect(resultsProps.lockedCount).toBeGreaterThan(0);
    // Pre-redaction keyword-gap total (2), even though free redaction empties
    // market.gap.keywordGap on the returned report.
    expect(resultsProps.gapTotal).toBe(2);
  });

  it("computes badgeTotal from the score card", () => {
    const payload = report();
    const { report: redacted, badgeTotal } = publicReportProps(payload, "bloom-io", "https://bloom.io");
    expect(badgeTotal).toBe(buildScoreCard(redacted).total);
  });

  it("does not import currentUser/entitlementsFor (never branches on viewer entitlement)", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./public-report.tsx", import.meta.url), "utf8"),
    );
    expect(src).not.toMatch(/import[^;]*\bcurrentUser\b/);
    expect(src).not.toMatch(/import[^;]*\bentitlementsFor\b/);
  });
});
