/**
 * report.test.ts — TDD for assembleReport (§5.6)
 *
 * Coverage:
 *   - Action bucketing by effortMin (§10.3 horizon mix)
 *   - All four questions populated correctly
 *   - Empty-actions degrades gracefully (all buckets are empty arrays)
 *   - whoItsFor.signals clamped to 6
 *   - generatedAt / mode pass-through
 *   - score pass-through
 */

import { describe, expect, test } from "vitest";
import { assembleReport } from "./report";
import type { ActionCard, Finding, PositioningMirror } from "@/lib/llm/types";
import type { VerifiedScore } from "@/lib/scan/score-full";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const POSITIONING_MIRROR: PositioningMirror = {
  listingSays: "Build habits in 21 days",
  reviewsValue: "daily streaks that actually stick",
  gap: "Listing focuses on duration; users care about consistency",
};

const SAMPLE_FINDING: Finding = {
  category: "content",
  claim: "Listing '21-day' claim mismatches reviews that praise streaks",
  basis: "evidence_based",
  confidence: 0.85,
  evidence: [{ excerpt: "the streak feature keeps me going", source: "review_themes" }],
};

const SAMPLE_SCORE: VerifiedScore = {
  total: 42,
  breakdown: { content: 20, outreach: 15, seo: 60 },
  radar: [
    { axis: "Content", value: 20, active: true, assessed: true },
    { axis: "Outreach", value: 15, active: true, assessed: true },
    { axis: "SEO/ASO", value: 60, active: true, assessed: true },
    { axis: "Ads", value: 0, active: false, assessed: false },
    { axis: "Partnerships", value: 0, active: false, assessed: false },
    { axis: "PR", value: 0, active: false, assessed: false },
    { axis: "Positioning", value: 0, active: false, assessed: false },
  ],
  basis: "verified",
};

const SURFACES = [
  { source: "reddit", title: "r/habittracking", url: "https://reddit.com/r/habittracking" },
  { source: "youtube", title: "Habit coach channel", url: "https://youtube.com/@habitcoach" },
];

const COMPETITOR_GAP = [
  { competitor: "Habitify", dimension: "store_keywords", them: 80, you: 30 },
];

/** Build an ActionCard with the given effortMin */
function makeCard(effortMin: number, overrides: Partial<ActionCard> = {}): ActionCard {
  return {
    category: "content",
    title: `Action at ${effortMin}min`,
    why: "Supported by review evidence.",
    evidenceIds: [],
    evidence: [
      { excerpt: "streak feature", source: "review_themes", sourceType: "app_store_rss" },
      { excerpt: "habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
    ],
    effortMin,
    suggestedDeadline: "2026-07-01",
    expectedOutcome: { scoreComponent: "content", delta: 3 },
    draft: "Draft text here.",
    draftRequiresEdit: true,
    verification: { method: "url", state: "pending" },
    basis: "evidence_based",
    confidence: 0.8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Action bucketing (§10.3)
// ---------------------------------------------------------------------------

describe("assembleReport — action bucketing by effortMin", () => {
  test("effortMin < 30 goes to quickWins", () => {
    const card = makeCard(15);
    const report = assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [SAMPLE_FINDING],
      icpSignals: ["streak consistency"],
      surfaces: SURFACES,
      competitorGap: COMPETITOR_GAP,
      actions: [card],
      score: SAMPLE_SCORE,
    });

    expect(report.whatToDoThisWeek.quickWins).toHaveLength(1);
    expect(report.whatToDoThisWeek.medium).toHaveLength(0);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(0);
    expect(report.whatToDoThisWeek.quickWins[0]?.title).toBe("Action at 15min");
  });

  test("effortMin === 29 goes to quickWins (boundary)", () => {
    const card = makeCard(29);
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [card],
      score: SAMPLE_SCORE,
    });
    expect(report.whatToDoThisWeek.quickWins).toHaveLength(1);
    expect(report.whatToDoThisWeek.medium).toHaveLength(0);
  });

  test("effortMin === 30 goes to medium (boundary)", () => {
    const card = makeCard(30);
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [card],
      score: SAMPLE_SCORE,
    });
    expect(report.whatToDoThisWeek.quickWins).toHaveLength(0);
    expect(report.whatToDoThisWeek.medium).toHaveLength(1);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(0);
  });

  test("effortMin === 120 goes to medium (boundary)", () => {
    const card = makeCard(120);
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [card],
      score: SAMPLE_SCORE,
    });
    expect(report.whatToDoThisWeek.medium).toHaveLength(1);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(0);
  });

  test("effortMin === 121 goes to longPlay (boundary)", () => {
    const card = makeCard(121);
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [card],
      score: SAMPLE_SCORE,
    });
    expect(report.whatToDoThisWeek.medium).toHaveLength(0);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(1);
  });

  test("effortMin > 120 goes to longPlay", () => {
    const card = makeCard(240);
    const report = assembleReport({
      mode: "android",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [SAMPLE_FINDING],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [card],
      score: SAMPLE_SCORE,
    });

    expect(report.whatToDoThisWeek.quickWins).toHaveLength(0);
    expect(report.whatToDoThisWeek.medium).toHaveLength(0);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(1);
  });

  test("mixed-effort actions land in the right buckets", () => {
    const actions = [
      makeCard(10),  // quickWin
      makeCard(20),  // quickWin
      makeCard(45),  // medium
      makeCard(90),  // medium
      makeCard(180), // longPlay
    ];
    const report = assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [SAMPLE_FINDING],
      icpSignals: ["signal-a"],
      surfaces: SURFACES,
      competitorGap: COMPETITOR_GAP,
      actions,
      score: SAMPLE_SCORE,
    });

    expect(report.whatToDoThisWeek.quickWins).toHaveLength(2);
    expect(report.whatToDoThisWeek.medium).toHaveLength(2);
    expect(report.whatToDoThisWeek.longPlay).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Empty-actions degrades gracefully
// ---------------------------------------------------------------------------

describe("assembleReport — empty actions", () => {
  test("all three buckets are empty arrays when no actions passed", () => {
    const report = assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
    });

    expect(report.whatToDoThisWeek.quickWins).toEqual([]);
    expect(report.whatToDoThisWeek.medium).toEqual([]);
    expect(report.whatToDoThisWeek.longPlay).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Four questions populated
// ---------------------------------------------------------------------------

describe("assembleReport — four questions", () => {
  function buildReport() {
    return assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T12:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [SAMPLE_FINDING],
      icpSignals: ["streak consistency", "simple UX", "daily reminders", "no overwhelm", "privacy-first", "offline use", "bonus-seventh"],
      surfaces: SURFACES,
      competitorGap: COMPETITOR_GAP,
      actions: [makeCard(20), makeCard(60), makeCard(180)],
      score: SAMPLE_SCORE,
    });
  }

  test("Q1 — whatYouOffer carries positioningMirror with all three fields", () => {
    const report = buildReport();
    expect(report.whatYouOffer.positioningMirror.listingSays).toBe("Build habits in 21 days");
    expect(report.whatYouOffer.positioningMirror.reviewsValue).toBe("daily streaks that actually stick");
    expect(report.whatYouOffer.positioningMirror.gap).toBeTruthy();
  });

  test("Q2 — whoItsFor.signals is limited to max 6 items", () => {
    const report = buildReport();
    expect(report.whoItsFor.signals.length).toBeLessThanOrEqual(6);
    // "bonus-seventh" should be dropped
    expect(report.whoItsFor.signals).not.toContain("bonus-seventh");
  });

  test("Q2 — whoItsFor.summary includes reviewsValue text", () => {
    const report = buildReport();
    expect(report.whoItsFor.summary).toContain("daily streaks that actually stick");
  });

  test("Q2 — whoItsFor.summary includes top ICP signal", () => {
    const report = buildReport();
    expect(report.whoItsFor.summary).toContain("streak consistency");
  });

  test("Q3 — whereTheyAre.surfaces matches input", () => {
    const report = buildReport();
    expect(report.whereTheyAre.surfaces).toHaveLength(2);
    expect(report.whereTheyAre.surfaces[0]?.source).toBe("reddit");
  });

  test("Q3 — whereTheyAre.competitorGap matches input", () => {
    const report = buildReport();
    expect(report.whereTheyAre.competitorGap).toHaveLength(1);
    expect(report.whereTheyAre.competitorGap[0]?.competitor).toBe("Habitify");
  });

  test("Q4 — whatToDoThisWeek action plan contains the passed actions", () => {
    const report = buildReport();
    const total =
      report.whatToDoThisWeek.quickWins.length +
      report.whatToDoThisWeek.medium.length +
      report.whatToDoThisWeek.longPlay.length;
    expect(total).toBe(3);
  });

  test("score is passed through verbatim", () => {
    const report = buildReport();
    expect(report.score.total).toBe(42);
    expect(report.score.basis).toBe("verified");
    expect(report.score.radar).toHaveLength(7);
  });

  test("mode and generatedAt are passed through verbatim", () => {
    const report = buildReport();
    expect(report.mode).toBe("ios");
    expect(report.generatedAt).toBe("2026-07-01T12:00:00Z");
  });
});

// ---------------------------------------------------------------------------
// whoItsFor edge cases
// ---------------------------------------------------------------------------

describe("assembleReport — whoItsFor edge cases", () => {
  test("empty icpSignals with reviewsValue produces a non-empty summary", () => {
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
    });
    expect(report.whoItsFor.summary.length).toBeGreaterThan(0);
    expect(report.whoItsFor.signals).toEqual([]);
  });

  test("empty icpSignals and empty reviewsValue returns fallback message", () => {
    const blankMirror: PositioningMirror = {
      listingSays: "Some product",
      reviewsValue: "",
      gap: "No gap identified",
    };
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: blankMirror,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
    });
    expect(report.whoItsFor.summary.length).toBeGreaterThan(0);
  });

  test("exactly 6 icpSignals are kept intact", () => {
    const sixSignals = ["a", "b", "c", "d", "e", "f"];
    const report = assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: sixSignals,
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
    });
    expect(report.whoItsFor.signals).toHaveLength(6);
    expect(report.whoItsFor.signals).toEqual(sixSignals);
  });
});

// ---------------------------------------------------------------------------
// Deep sections (surfaced from already-computed data)
// ---------------------------------------------------------------------------

describe("assembleReport — deep sections", () => {
  test("populates all four deep sections when provided, mapping findings→diagnostics", () => {
    const report = assembleReport({
      mode: "ios",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [SAMPLE_FINDING],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
      competitiveLandscape: [
        { competitor: "Habitify", positioning: "analytics-heavy", gap: "too complex", communityMentions: 9, creators: [{ name: "Chan", url: "https://yt/1" }] },
      ],
      channelOpportunities: {
        keywordClusters: [{ theme: "habit", keywords: [{ keyword: "habit tracker", volume: 8100, cpc: 1.2, competition: 0.4 }] }],
        communitiesByEngagement: [{ source: "hn", title: "Ask HN", url: "https://h/1", engagement: 300 }],
      },
      creatorsToReach: [{ name: "Chan", url: "https://yt/1", coveredCompetitor: "Habitify", audienceProxy: 0 }],
      reviewThemes: {
        strengths: [{ theme: "streaks", quote: "keeps me going" }],
        weaknesses: [{ theme: "crashes", quote: "crashes daily" }],
        mixed: [{ theme: "widget", quote: "nice but flaky" }],
      },
    });

    expect(report.competitiveLandscape).toHaveLength(1);
    expect(report.competitiveLandscape?.[0]?.creators[0]?.name).toBe("Chan");
    expect(report.channelOpportunities?.keywordClusters[0]?.keywords[0]?.cpc).toBe(1.2);
    expect(report.channelOpportunities?.communitiesByEngagement[0]?.engagement).toBe(300);
    expect(report.creatorsToReach).toHaveLength(1);
    // strengths/weaknesses/mixed pass through; diagnostics derive from findings
    expect(report.strengthsAndWeaknesses?.strengths[0]?.quote).toBe("keeps me going");
    expect(report.strengthsAndWeaknesses?.weaknesses[0]?.theme).toBe("crashes");
    expect(report.strengthsAndWeaknesses?.mixed[0]?.theme).toBe("widget");
    expect(report.strengthsAndWeaknesses?.diagnostics).toEqual([
      { category: "content", claim: SAMPLE_FINDING.claim, confidence: 0.85 },
    ]);
  });

  test("degrades to empty deep sections when not provided (legacy callers)", () => {
    const report = assembleReport({
      mode: "web",
      generatedAt: "2026-07-01T00:00:00Z",
      positioningMirror: POSITIONING_MIRROR,
      findings: [],
      icpSignals: [],
      surfaces: [],
      competitorGap: [],
      actions: [],
      score: SAMPLE_SCORE,
    });

    expect(report.competitiveLandscape).toEqual([]);
    expect(report.channelOpportunities).toEqual({ keywordClusters: [], communitiesByEngagement: [] });
    expect(report.creatorsToReach).toEqual([]);
    expect(report.strengthsAndWeaknesses).toEqual({
      strengths: [],
      weaknesses: [],
      mixed: [],
      diagnostics: [],
    });
  });
});
