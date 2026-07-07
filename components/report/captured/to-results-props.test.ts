/**
 * to-results-props.test.ts — regression coverage for the live "top 0 ranked
 * fixes / 0 of 0 queries" bug (bloom.io scan 388982c5).
 *
 * Two display-layer failure modes guarded here:
 *  1. Actions exist but every card has a non-positive/missing expectedOutcome
 *     delta — the old strict `delta > 0` filter silently emptied the fixes list.
 *  2. The redacted (free-tier) report has `market.gap.keywordGap` emptied, so
 *     the gap footer read "Showing 0 of 0 queries" even when the full payload
 *     had queries — the page must pass the pre-redaction total, like it already
 *     does for actions.
 */

import { describe, it, expect } from "vitest";
import { toResultsProps } from "./to-results-props";
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
    draft: null,
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

describe("toResultsProps — fixes", () => {
  it("ranks positive-delta actions by delta and previews 3", () => {
    const p = toResultsProps(
      report({
        whatToDoThisWeek: {
          quickWins: [action("a", 2), action("b", 9)],
          medium: [action("c", 5, 60)],
          longPlay: [action("d", 7, 200)],
        },
      }),
      "bloom.io",
    );
    expect(p.fixes.map((f) => f.title)).toEqual(["b", "d", "c"]);
    expect(p.lockedCount).toBe(1);
  });

  it("does NOT hide actions when every delta is 0/absent (regression: silent empty fixes)", () => {
    const zeroDelta = [action("x", 0), action("y", 0)];
    const p = toResultsProps(
      report({ whatToDoThisWeek: { quickWins: zeroDelta, medium: [], longPlay: [] } }),
      "bloom.io",
    );
    expect(p.fixes).toHaveLength(2);
    expect(p.fixes.map((f) => f.title)).toEqual(["x", "y"]);
  });

  it("derives 0-of-0 only when the payload truly has no actions", () => {
    const p = toResultsProps(report(), "bloom.io", 0);
    expect(p.fixes).toHaveLength(0);
    expect(p.lockedCount).toBe(0);
  });
});

describe("toResultsProps — search gap total", () => {
  const kg = [
    { keyword: "photo gallery website", volume: 4400, cpc: 1, competition: 0.2 },
    { keyword: "portfolio builder", volume: 900, cpc: 1, competition: 0.2 },
  ];

  it("uses the report's keywordGap for rows and total when present", () => {
    const p = toResultsProps(
      report({
        market: { gap: { keywordGap: kg } } as unknown as ReportPayload["market"],
      }),
      "bloom.io",
    );
    expect(p.gapRows).toHaveLength(2);
    expect(p.gapTotal).toBe(2);
    expect(p.gapRows[0]!.opp).toBe("High");
  });

  it("honours the pre-redaction total when the redacted report has an emptied keywordGap", () => {
    // Free-tier redaction empties market.gap.keywordGap; the page passes the
    // full payload's count so the teaser can say "Showing 0 of 12".
    const p = toResultsProps(report(), "bloom.io", 7, 12);
    expect(p.gapRows).toHaveLength(0);
    expect(p.gapTotal).toBe(12);
  });
});

describe("toResultsProps — pillar measurement (A6)", () => {
  const radar = [
    { axis: "Content", value: 100, active: true, assessed: true },
    { axis: "Outreach", value: 0, active: true, assessed: false },
    { axis: "SEO/ASO", value: 76, active: true, assessed: true },
  ];

  it("marks an unassessed pillar measured:false, never a damning 0/100", () => {
    const p = toResultsProps(
      report({ score: { total: 86, breakdown: { content: 100, outreach: 0, seo: 76 }, radar, basis: "verified" } }),
      "trustmrr.com",
      5,
    );
    expect(p.pillars.find((x) => x.label === "Outreach")!.measured).toBe(false);
    expect(p.pillars.find((x) => x.label === "Content")!.measured).toBe(true);
    expect(p.pillars.find((x) => x.label === "SEO")!.measured).toBe(true);
  });

  it("does not pick an unmeasured pillar as the biggest lever", () => {
    const p = toResultsProps(
      report({ score: { total: 86, breakdown: { content: 100, outreach: 0, seo: 76 }, radar, basis: "verified" } }),
      "trustmrr.com",
      5,
    );
    // SEO (76) is the weakest MEASURED pillar → the lever, not Outreach's unearned 0.
    expect(p.pillars.find((x) => x.label === "SEO")!.note).toBe("biggest lever");
    expect(p.pillars.find((x) => x.label === "Outreach")!.note).not.toBe("biggest lever");
  });

  it("treats an empty radar as all-measured (backward compatible)", () => {
    const p = toResultsProps(report(), "site", 3);
    expect(p.pillars.every((x) => x.measured)).toBe(true);
  });
});
