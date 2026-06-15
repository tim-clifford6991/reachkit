/**
 * Unit tests for lib/eval/score.ts — pure, no DB, no async.
 *
 * The scorer is now PIPELINE-DRIVEN: coverage is judged against the SURVIVING
 * safe actions (post-Critic + post-§11), NOT the fixture's static findings.
 * These tests prove the new dimensions have teeth:
 *   - perfect surviving-action input → all sub-scores 1.0
 *   - a whole missing action category → categoryCoverage penalized + floor FAIL
 *   - a dropped action (fewer survivors) → actionScore penalized
 *   - keyword carried only by a dropped action → categoryCoverage penalized
 *   - evidence requirement, scoreBand bounds, metadata passthrough
 */

import { describe, expect, test } from "vitest";
import { scoreFixture } from "./score";
import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import type { GoldenRubric } from "@/lib/eval/types";

type Category = "content" | "outreach" | "seo_aso";

// ---------------------------------------------------------------------------
// Helpers — minimal valid shapes
// ---------------------------------------------------------------------------

function makeAction(overrides: Partial<ActionCard> = {}): ActionCard {
  return {
    category: "content",
    title: "Add symptom tracker keyword to listing",
    why: "Reviews cite correlation as the standout for chronic illness self-managers",
    evidenceIds: [],
    evidence: [
      { excerpt: "symptom tracker is what i searched for", source: "https://example.com/a", sourceType: "app_store_rss" },
      { excerpt: "correlation between sleep and chronic flares", source: "https://example.com/b", sourceType: "dataforseo_serp" },
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

/** A surviving action set that covers all 3 categories + both base keywords. */
function fullCoverageActions(): ActionCard[] {
  return [
    makeAction({ category: "content", title: "content card", evidence: [
      { excerpt: "symptom tracker keyword", source: "https://example.com/c", sourceType: "app_store_rss" },
      { excerpt: "second", source: "https://example.com/c2", sourceType: "dataforseo_keywords" },
    ] }),
    makeAction({ category: "seo_aso", title: "seo card", why: "correlation aso", evidence: [
      { excerpt: "correlation aso opportunity", source: "https://example.com/d", sourceType: "dataforseo_keywords" },
      { excerpt: "second", source: "https://example.com/d2", sourceType: "dataforseo_serp" },
    ] }),
    makeAction({ category: "outreach", title: "outreach card", why: "community", evidence: [
      { excerpt: "reach the community", source: "https://example.com/e", sourceType: "communities" },
      { excerpt: "second", source: "https://example.com/e2", sourceType: "dataforseo_serp" },
    ] }),
  ];
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
        { axis: "Content", value: 5, active: true, assessed: true },
        { axis: "Outreach", value: 3, active: true, assessed: true },
        { axis: "SEO/ASO", value: 10, active: true, assessed: true },
        { axis: "Ads", value: 0, active: false, assessed: false },
        { axis: "Partnerships", value: 0, active: false, assessed: false },
        { axis: "PR", value: 0, active: false, assessed: false },
        { axis: "Positioning", value: 0, active: false, assessed: false },
      ],
      basis: "verified",
    },
  };
}

const BASE_RUBRIC: GoldenRubric = {
  expectedActiveCategories: ["content", "seo_aso", "outreach"],
  expectedKeywords: ["symptom tracker", "correlation"],
  minActions: 3,
  requireEvidence: true,
  scoreBand: [0, 100],
};

const META = { candidateCount: 5, fixtureId: "test", appName: "TestApp" };

// ---------------------------------------------------------------------------
// Perfect (surviving-action) input → 1.0
// ---------------------------------------------------------------------------

describe("scoreFixture — perfect surviving-action input", () => {
  test("all sub-scores are 1.0 and mean is 1.0, floor met", () => {
    const result = scoreFixture(makeReport(15), fullCoverageActions(), BASE_RUBRIC, META);

    expect(result.categoryCoverage).toBe(1);
    expect(result.actionScore).toBe(1);
    expect(result.evidenceScore).toBe(1);
    expect(result.scorePlausible).toBe(1);
    expect(result.score).toBe(1);
    expect(result.categoryFloorMet).toBe(true);
    expect(result.missingCategories).toEqual([]);
    expect(result.notes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Per-category floor — the §11-cap-zeroes-a-category regression catcher
// ---------------------------------------------------------------------------

describe("scoreFixture — per-category action floor", () => {
  test("a whole missing category (no surviving outreach) → floor FAIL + categoryCoverage penalized", () => {
    // content + seo_aso survive; outreach was dropped entirely by §11
    const surviving: ActionCard[] = [
      makeAction({ category: "content", evidence: [
        { excerpt: "symptom tracker", source: "https://example.com/a", sourceType: "app_store_rss" },
        { excerpt: "x", source: "https://example.com/a2", sourceType: "dataforseo_keywords" },
      ] }),
      makeAction({ category: "seo_aso", evidence: [
        { excerpt: "correlation", source: "https://example.com/b", sourceType: "dataforseo_keywords" },
        { excerpt: "x", source: "https://example.com/b2", sourceType: "dataforseo_serp" },
      ] }),
    ];

    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);

    // floor fraction = 2/3 (outreach missing); keywords still 1 → coverage = (2/3 + 1)/2 = 5/6
    expect(result.categoryFloorMet).toBe(false);
    expect(result.missingCategories).toEqual(["outreach"]);
    expect(result.categoryCoverage).toBeCloseTo(5 / 6);
    expect(result.score).toBeLessThan(1);
    expect(result.notes.some((n) => n.includes("outreach"))).toBe(true);
  });

  test("two missing categories → floor fraction 1/3", () => {
    // only content survives
    const surviving: ActionCard[] = [
      makeAction({ category: "content", evidence: [
        { excerpt: "symptom tracker correlation", source: "https://example.com/a", sourceType: "app_store_rss" },
        { excerpt: "x", source: "https://example.com/a2", sourceType: "dataforseo_keywords" },
      ] }),
    ];

    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);

    // floor fraction = 1/3 (seo_aso + outreach missing); keywords = 1 → coverage = (1/3 + 1)/2 = 2/3
    expect(result.categoryFloorMet).toBe(false);
    expect(result.missingCategories.sort()).toEqual(["outreach", "seo_aso"]);
    expect(result.categoryCoverage).toBeCloseTo(2 / 3);
  });

  test("no surviving actions → floor fraction 0, all categories missing", () => {
    const result = scoreFixture(makeReport(15), [], BASE_RUBRIC, META);

    // floor fraction = 0; keyword coverage over empty text = 0 → coverage = 0
    expect(result.categoryFloorMet).toBe(false);
    expect(result.missingCategories.sort()).toEqual(["content", "outreach", "seo_aso"]);
    expect(result.categoryCoverage).toBe(0);
  });

  test("empty expectedActiveCategories → floor trivially met", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, expectedActiveCategories: [] as Category[] };
    const result = scoreFixture(makeReport(15), fullCoverageActions(), rubric, META);

    expect(result.categoryFloorMet).toBe(true);
    expect(result.missingCategories).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Keyword coverage — PIPELINE-DRIVEN (scored against surviving actions' text)
// ---------------------------------------------------------------------------

describe("scoreFixture — keyword coverage over surviving actions", () => {
  test("keyword carried only by a DROPPED action lowers categoryCoverage", () => {
    // All 3 categories survive (floor met) but 'correlation' lived only on the
    // dropped card; surviving cards mention only 'symptom tracker'.
    const surviving: ActionCard[] = [
      makeAction({ category: "content", why: "symptom tracker only", draft: "symptom tracker", evidence: [
        { excerpt: "symptom tracker", source: "https://example.com/a", sourceType: "app_store_rss" },
        { excerpt: "x", source: "https://example.com/a2", sourceType: "dataforseo_keywords" },
      ] }),
      makeAction({ category: "seo_aso", title: "aso", why: "aso work", draft: null, evidence: [
        { excerpt: "keyword field", source: "https://example.com/b", sourceType: "dataforseo_keywords" },
        { excerpt: "x", source: "https://example.com/b2", sourceType: "dataforseo_serp" },
      ] }),
      makeAction({ category: "outreach", title: "reach", why: "community", draft: "post it", evidence: [
        { excerpt: "community thread", source: "https://example.com/c", sourceType: "communities" },
        { excerpt: "x", source: "https://example.com/c2", sourceType: "dataforseo_serp" },
      ] }),
    ];

    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);

    // floor = 1 (all categories present); keyword 'correlation' missing → kwFraction = 1/2
    // coverage = (1 + 0.5)/2 = 0.75
    expect(result.categoryFloorMet).toBe(true);
    expect(result.categoryCoverage).toBeCloseTo(0.75);
    expect(result.notes.some((n) => n.includes("correlation"))).toBe(true);
  });

  test("keyword match is case-insensitive across surviving action text", () => {
    const surviving: ActionCard[] = [
      makeAction({ category: "content", title: "SYMPTOM TRACKER focus", why: "x", evidence: [
        { excerpt: "a", source: "https://example.com/a", sourceType: "app_store_rss" },
        { excerpt: "b", source: "https://example.com/a2", sourceType: "dataforseo_keywords" },
      ] }),
      makeAction({ category: "seo_aso", title: "CORRELATION engine", why: "x", evidence: [
        { excerpt: "a", source: "https://example.com/b", sourceType: "dataforseo_keywords" },
        { excerpt: "b", source: "https://example.com/b2", sourceType: "dataforseo_serp" },
      ] }),
      makeAction({ category: "outreach", title: "reach", why: "x", evidence: [
        { excerpt: "a", source: "https://example.com/c", sourceType: "communities" },
        { excerpt: "b", source: "https://example.com/c2", sourceType: "dataforseo_serp" },
      ] }),
    ];

    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);
    expect(result.categoryCoverage).toBe(1);
  });

  test("keyword in evidence excerpt of a surviving action counts", () => {
    const surviving: ActionCard[] = [
      makeAction({ category: "content", title: "t", why: "w", draft: "d", evidence: [
        { excerpt: "users searched symptom tracker and correlation", source: "https://example.com/a", sourceType: "app_store_rss" },
        { excerpt: "second", source: "https://example.com/a2", sourceType: "dataforseo_keywords" },
      ] }),
      makeAction({ category: "seo_aso", title: "t", why: "w", draft: null, evidence: [
        { excerpt: "a", source: "https://example.com/b", sourceType: "dataforseo_keywords" },
        { excerpt: "b", source: "https://example.com/b2", sourceType: "dataforseo_serp" },
      ] }),
      makeAction({ category: "outreach", title: "t", why: "w", evidence: [
        { excerpt: "a", source: "https://example.com/c", sourceType: "communities" },
        { excerpt: "b", source: "https://example.com/c2", sourceType: "dataforseo_serp" },
      ] }),
    ];

    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);
    expect(result.categoryCoverage).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Dropped action → lower actionScore
// ---------------------------------------------------------------------------

describe("scoreFixture — action count (a dropped action is penalized)", () => {
  test("zero safe actions → actionScore = 0", () => {
    const result = scoreFixture(makeReport(15), [], BASE_RUBRIC, META);

    expect(result.actionScore).toBe(0);
    expect(result.notes.some((n) => n.includes("safe actions"))).toBe(true);
  });

  test("1 safe action when minActions=3 → actionScore = 1/3", () => {
    const surviving: ActionCard[] = [makeAction()];
    const result = scoreFixture(makeReport(15), surviving, BASE_RUBRIC, META);

    expect(result.actionScore).toBeCloseTo(1 / 3);
  });

  test("dropping one of three survivors lowers actionScore below 1", () => {
    const full = scoreFixture(makeReport(15), fullCoverageActions(), BASE_RUBRIC, META);
    const dropped = scoreFixture(makeReport(15), fullCoverageActions().slice(0, 2), BASE_RUBRIC, META);

    expect(full.actionScore).toBe(1);
    expect(dropped.actionScore).toBeLessThan(full.actionScore);
    expect(dropped.actionScore).toBeCloseTo(2 / 3);
    expect(dropped.score).toBeLessThan(full.score);
  });

  test("exactly minActions → actionScore = 1.0", () => {
    const result = scoreFixture(makeReport(15), fullCoverageActions(), BASE_RUBRIC, META);
    expect(result.actionScore).toBe(1);
  });

  test("more than minActions → actionScore clamped to 1.0", () => {
    const many = [...fullCoverageActions(), makeAction(), makeAction()];
    const result = scoreFixture(makeReport(15), many, BASE_RUBRIC, META);
    expect(result.actionScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Evidence requirement
// ---------------------------------------------------------------------------

describe("scoreFixture — evidenceScore", () => {
  test("requireEvidence=false → evidenceScore always 1", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, requireEvidence: false };
    const noEvidence = fullCoverageActions().map((a) => ({ ...a, evidence: [] }));

    const result = scoreFixture(makeReport(15), noEvidence, rubric, META);
    expect(result.evidenceScore).toBe(1);
  });

  test("requireEvidence=true + an action with 0 evidence → reduced evidenceScore", () => {
    const actions = fullCoverageActions();
    const withOneBad: ActionCard[] = [
      actions[0]!,
      { ...actions[1]!, evidence: [] },
      actions[2]!,
    ];

    const result = scoreFixture(makeReport(15), withOneBad, BASE_RUBRIC, META);

    // 2 of 3 have ≥2 evidence
    expect(result.evidenceScore).toBeCloseTo(2 / 3);
    expect(result.notes.some((n) => n.includes("evidenceScore"))).toBe(true);
  });

  test("empty surviving set with requireEvidence=true → evidenceScore = 1 (vacuously, no actions to fault)", () => {
    const result = scoreFixture(makeReport(15), [], BASE_RUBRIC, META);
    expect(result.evidenceScore).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Out-of-band score → scorePlausible = 0
// ---------------------------------------------------------------------------

describe("scoreFixture — scorePlausible", () => {
  test("score within band → scorePlausible = 1", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [5, 30] };
    const result = scoreFixture(makeReport(15), fullCoverageActions(), rubric, META);
    expect(result.scorePlausible).toBe(1);
  });

  test("score below band → scorePlausible = 0", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [20, 50] };
    const result = scoreFixture(makeReport(10), fullCoverageActions(), rubric, META);

    expect(result.scorePlausible).toBe(0);
    expect(result.notes.some((n) => n.includes("scorePlausible"))).toBe(true);
  });

  test("score above band → scorePlausible = 0", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [0, 10] };
    const result = scoreFixture(makeReport(20), fullCoverageActions(), rubric, META);
    expect(result.scorePlausible).toBe(0);
  });

  test("exact boundary values are inclusive", () => {
    const rubric: GoldenRubric = { ...BASE_RUBRIC, scoreBand: [5, 15] };
    const actions = fullCoverageActions();

    expect(scoreFixture(makeReport(5), actions, rubric, META).scorePlausible).toBe(1);
    expect(scoreFixture(makeReport(15), actions, rubric, META).scorePlausible).toBe(1);
    expect(scoreFixture(makeReport(4), actions, rubric, META).scorePlausible).toBe(0);
    expect(scoreFixture(makeReport(16), actions, rubric, META).scorePlausible).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Combined regression: a §11 cap that zeroes a category AND drops a survivor
// must tank multiple sub-scores at once (this is the exact Cycle-3 regression).
// ---------------------------------------------------------------------------

describe("scoreFixture — combined regression has teeth", () => {
  test("dropping the only outreach card both fails the floor and lowers actionScore + mean", () => {
    const good = scoreFixture(makeReport(15), fullCoverageActions(), BASE_RUBRIC, META);

    // Simulate §11 zeroing outreach: keep content + seo_aso only (2 of 3 survive)
    const regressed = scoreFixture(
      makeReport(15),
      fullCoverageActions().filter((a) => a.category !== "outreach"),
      BASE_RUBRIC,
      META,
    );

    expect(good.score).toBe(1);
    expect(good.categoryFloorMet).toBe(true);

    expect(regressed.categoryFloorMet).toBe(false);
    expect(regressed.categoryCoverage).toBeLessThan(good.categoryCoverage);
    expect(regressed.actionScore).toBeLessThan(good.actionScore);
    expect(regressed.score).toBeLessThan(good.score);
  });
});

// ---------------------------------------------------------------------------
// Metadata fields
// ---------------------------------------------------------------------------

describe("scoreFixture — metadata", () => {
  test("fixtureId and appName are passed through; safeCount reflects surviving set", () => {
    const result = scoreFixture(makeReport(15), fullCoverageActions(), BASE_RUBRIC, {
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
