/**
 * Unit tests for lib/eval/score.ts — pure, no DB, no async.
 *
 * Tests:
 *   - perfect input → score 1.0
 *   - missing finding category → lower findingsCoverage
 *   - missing keyword → lower findingsCoverage
 *   - too few actions → lower actionScore
 *   - evidence requirement fails → lower evidenceScore
 *   - out-of-band score.total → scorePlausible = 0
 */

import { describe, expect, test } from "vitest";
import { scoreFixture } from "./score";
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard, Finding } from "@/lib/llm/types";
import type { GoldenRubric } from "@/lib/eval/types";

// ---------------------------------------------------------------------------
// Helpers — minimal valid shapes
// ---------------------------------------------------------------------------

function makeAction(overrides: Partial<ActionCard> = {}): ActionCard {
  return {
    category: "content",
    title: "Test action",
    why: "Because evidence says so",
    evidenceIds: [],
    evidence: [
      { excerpt: "excerpt one", source: "https://example.com/a", sourceType: "app_store_rss" },
      { excerpt: "excerpt two", source: "https://example.com/b", sourceType: "dataforseo_serp" },
    ],
    effortMin: 30,
    suggestedDeadline: "2026-07-01",
    expectedOutcome: { scoreComponent: "content", delta: 5 },
    draft: "This is the draft text for this action card.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    category: "content",
    claim: "The app store listing lacks the keyword 'symptom tracker' which drives 4,400 monthly searches.",
    basis: "evidence_based",
    confidence: 0.85,
    evidence: [{ excerpt: "symptom tracker", source: "keyword_data" }],
    ...overrides,
  };
}

function makeReport(scoreTotal: number): ReportPayload {
  return {
    mode: "ios",
    generatedAt: "2026-06-13T00:00:00.000Z",
    whatYouOffer: {
      positioningMirror: {
        listingSays: "Track your symptoms daily",
        reviewsValue: "Users love correlation insights",
        gap: "Listing under-emphasises correlation features",
      },
    },
    whoItsFor: {
      summary: "Chronic illness self-trackers",
      signals: ["chronic illness", "symptom correlation"],
    },
    whereTheyAre: {
      surfaces: [],
      competitorGap: [],
    },
    whatToDoThisWeek: {
      quickWins: [],
      medium: [],
      longPlay: [],
    },
    score: {
      total: scoreTotal,
      breakdown: { content: 5, outreach: 3, seo: 10 },
      radar: [
        { axis: "Content", value: 5, active: true },
        { axis: "Outreach", value: 3, active: true },
        { axis: "SEO/ASO", value: 10, active: true },
        { axis: "Ads", value: 0, active: false },
        { axis: "Partnerships", value: 0, active: false },
        { axis: "PR", value: 0, active: false },
        { axis: "Positioning", value: 0, active: false },
      ],
      basis: "verified",
    },
  };
}

const BASE_RUBRIC: GoldenRubric = {
  expectedFindingCategories: ["content", "seo_aso", "outreach"],
  expectedKeywords: ["symptom tracker", "correlation"],
  minActions: 3,
  requireEvidence: true,
  scoreBand: [0, 100],
};

const META = { candidateCount: 5, fixtureId: "test", appName: "TestApp" };

// ---------------------------------------------------------------------------
// Perfect input → 1.0
// ---------------------------------------------------------------------------

describe("scoreFixture — perfect input", () => {
  test("all sub-scores are 1.0 and mean is 1.0", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker keyword missing in listing" }),
      makeFinding({ category: "seo_aso", claim: "correlation features need ASO keywords" }),
      makeFinding({ category: "outreach", claim: "outreach to chronic illness communities" }),
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    expect(result.findingsCoverage).toBe(1);
    expect(result.actionScore).toBe(1);
    expect(result.evidenceScore).toBe(1);
    expect(result.scorePlausible).toBe(1);
    expect(result.score).toBe(1);
    expect(result.notes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Missing finding category → lower findingsCoverage
// ---------------------------------------------------------------------------

describe("scoreFixture — missing finding categories", () => {
  test("missing 'outreach' category reduces findingsCoverage", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker keyword missing" }),
      makeFinding({ category: "seo_aso", claim: "correlation aso opportunity" }),
      // no outreach finding
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    // catFraction = 2/3; kwFraction = 1 (both keywords present); mean = (2/3+1)/2 = 5/6
    expect(result.findingsCoverage).toBeCloseTo(5 / 6);
    expect(result.score).toBeLessThan(1);
    expect(result.notes.some((n) => n.includes("outreach"))).toBe(true);
  });

  test("all categories missing → findingsCoverage near 0", () => {
    const findings: Finding[] = [];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    // catFraction = 0/3 = 0; kwFraction = 0/2 = 0; mean = 0
    expect(result.findingsCoverage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Missing keyword → lower findingsCoverage
// ---------------------------------------------------------------------------

describe("scoreFixture — missing keywords", () => {
  test("missing keyword reduces findingsCoverage", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker is important" }),
      makeFinding({ category: "seo_aso", claim: "ASO opportunity" }),
      makeFinding({ category: "outreach", claim: "community outreach" }),
      // 'correlation' not in any claim
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    // catFraction = 1; kwFraction = 1/2; mean = (1 + 0.5)/2 = 0.75
    expect(result.findingsCoverage).toBeCloseTo(0.75);
    expect(result.notes.some((n) => n.includes("correlation"))).toBe(true);
  });

  test("keyword search is case-insensitive", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "SYMPTOM TRACKER keyword is missing" }),
      makeFinding({ category: "seo_aso", claim: "CORRELATION features not highlighted" }),
      makeFinding({ category: "outreach", claim: "outreach opportunity" }),
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    expect(result.findingsCoverage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Too few actions → lower actionScore
// ---------------------------------------------------------------------------

describe("scoreFixture — action count", () => {
  test("zero safe actions → actionScore = 0", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker keyword" }),
      makeFinding({ category: "seo_aso", claim: "correlation keywords" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(15);

    const result = scoreFixture(report, [], findings, BASE_RUBRIC, META);

    expect(result.actionScore).toBe(0);
    expect(result.notes.some((n) => n.includes("safe actions"))).toBe(true);
  });

  test("1 safe action when minActions=3 → actionScore = 1/3", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const safeActions: ActionCard[] = [makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    expect(result.actionScore).toBeCloseTo(1 / 3);
  });

  test("exactly minActions → actionScore = 1.0", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    expect(result.actionScore).toBe(1);
  });

  test("more than minActions → actionScore clamped to 1.0", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const safeActions: ActionCard[] = [
      makeAction(), makeAction(), makeAction(), makeAction(), makeAction(),
    ];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    expect(result.actionScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Evidence requirement
// ---------------------------------------------------------------------------

describe("scoreFixture — evidenceScore", () => {
  test("requireEvidence=false → evidenceScore always 1", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, requireEvidence: false };
    const badAction = makeAction({ evidence: [] }); // no evidence
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(15);

    const result = scoreFixture(report, [badAction, badAction, badAction], findings, rubric, META);

    expect(result.evidenceScore).toBe(1);
  });

  test("requireEvidence=true + action with 0 evidence → reduced evidenceScore", () => {
    const goodAction = makeAction(); // 2 evidence items
    const badAction = makeAction({ evidence: [] }); // 0 items
    const safeActions: ActionCard[] = [goodAction, badAction, goodAction];
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, META);

    // 2 out of 3 have ≥2 evidence
    expect(result.evidenceScore).toBeCloseTo(2 / 3);
    expect(result.notes.some((n) => n.includes("evidenceScore"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Out-of-band score → scorePlausible = 0
// ---------------------------------------------------------------------------

describe("scoreFixture — scorePlausible", () => {
  test("score within band → scorePlausible = 1", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [5, 30] };
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(15); // 15 is within [5,30]
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];

    const result = scoreFixture(report, safeActions, findings, rubric, META);

    expect(result.scorePlausible).toBe(1);
  });

  test("score below band → scorePlausible = 0", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [20, 50] };
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(10); // 10 is below [20,50]
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];

    const result = scoreFixture(report, safeActions, findings, rubric, META);

    expect(result.scorePlausible).toBe(0);
    expect(result.notes.some((n) => n.includes("scorePlausible"))).toBe(true);
  });

  test("score above band → scorePlausible = 0", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [0, 10] };
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const report = makeReport(20); // 20 is above [0,10]
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];

    const result = scoreFixture(report, safeActions, findings, rubric, META);

    expect(result.scorePlausible).toBe(0);
  });

  test("exact boundary values are inclusive", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [5, 15] };
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];

    expect(scoreFixture(makeReport(5), safeActions, findings, rubric, META).scorePlausible).toBe(1);
    expect(scoreFixture(makeReport(15), safeActions, findings, rubric, META).scorePlausible).toBe(1);
    expect(scoreFixture(makeReport(4), safeActions, findings, rubric, META).scorePlausible).toBe(0);
    expect(scoreFixture(makeReport(16), safeActions, findings, rubric, META).scorePlausible).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Metadata fields
// ---------------------------------------------------------------------------

describe("scoreFixture — metadata", () => {
  test("fixtureId and appName are passed through", () => {
    const findings: Finding[] = [
      makeFinding({ category: "content", claim: "symptom tracker" }),
      makeFinding({ category: "seo_aso", claim: "correlation" }),
      makeFinding({ category: "outreach", claim: "outreach" }),
    ];
    const safeActions: ActionCard[] = [makeAction(), makeAction(), makeAction()];
    const report = makeReport(15);

    const result = scoreFixture(report, safeActions, findings, BASE_RUBRIC, {
      candidateCount: 7,
      fixtureId: "bearable",
      appName: "Bearable",
    });

    expect(result.fixtureId).toBe("bearable");
    expect(result.appName).toBe("Bearable");
    expect(result.candidateCount).toBe(7);
    expect(result.safeCount).toBe(3);
  });
});
