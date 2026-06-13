/**
 * Pure, deterministic fixture scorer for the golden-set eval harness.
 *
 * scoreFixture() takes the assembled report + safe actions + findings + rubric
 * and returns a FixtureScore with four sub-scores (each 0..1) and their mean.
 *
 * NO DB, NO async — pure and deterministic.
 */

import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard, Finding } from "@/lib/llm/types";
import type { GoldenRubric, FixtureScore } from "@/lib/eval/types";

// ---------------------------------------------------------------------------
// Sub-score: findingsCoverage
// Mean of:
//   (a) fraction of expectedFindingCategories present in findings.categories
//   (b) fraction of expectedKeywords (case-insensitive) found in any finding claim
// ---------------------------------------------------------------------------

function scoreFindingsCoverage(
  findings: Finding[],
  rubric: GoldenRubric,
): { score: number; notes: string[] } {
  const notes: string[] = [];

  // (a) category coverage
  const presentCategories = new Set(findings.map((f) => f.category));
  const expectedCats = rubric.expectedFindingCategories;
  const missedCats = expectedCats.filter((c) => !presentCategories.has(c));
  const catFraction =
    expectedCats.length === 0
      ? 1
      : (expectedCats.length - missedCats.length) / expectedCats.length;

  if (missedCats.length > 0) {
    notes.push(
      `findingsCoverage: missing finding categories: ${missedCats.join(", ")}`,
    );
  }

  // (b) keyword coverage
  const allClaims = findings.map((f) => f.claim.toLowerCase()).join(" ");
  const expectedKws = rubric.expectedKeywords;
  const missedKws = expectedKws.filter((kw) => !allClaims.includes(kw.toLowerCase()));
  const kwFraction =
    expectedKws.length === 0
      ? 1
      : (expectedKws.length - missedKws.length) / expectedKws.length;

  if (missedKws.length > 0) {
    notes.push(
      `findingsCoverage: missing keywords in claims: ${missedKws.join(", ")}`,
    );
  }

  return { score: (catFraction + kwFraction) / 2, notes };
}

// ---------------------------------------------------------------------------
// Sub-score: actionScore
// min(1, safeActions.length / max(1, rubric.minActions))
// ---------------------------------------------------------------------------

function scoreActions(
  safeActions: ActionCard[],
  rubric: GoldenRubric,
): { score: number; notes: string[] } {
  const notes: string[] = [];
  const ratio = safeActions.length / Math.max(1, rubric.minActions);
  const score = Math.min(1, ratio);

  if (score < 1) {
    notes.push(
      `actionScore: only ${safeActions.length} safe actions; need ≥${rubric.minActions}`,
    );
  }

  return { score, notes };
}

// ---------------------------------------------------------------------------
// Sub-score: evidenceScore
// If requireEvidence: fraction of safeActions with ≥2 evidence items; else 1.
// ---------------------------------------------------------------------------

function scoreEvidence(
  safeActions: ActionCard[],
  rubric: GoldenRubric,
): { score: number; notes: string[] } {
  if (!rubric.requireEvidence || safeActions.length === 0) {
    return { score: 1, notes: [] };
  }

  const withEvidence = safeActions.filter((a) => a.evidence.length >= 2);
  const score = withEvidence.length / safeActions.length;

  const notes: string[] = [];
  if (score < 1) {
    const missing = safeActions.length - withEvidence.length;
    notes.push(
      `evidenceScore: ${missing} safe action(s) have <2 evidence items`,
    );
  }

  return { score, notes };
}

// ---------------------------------------------------------------------------
// Sub-score: scorePlausible
// 1 if report.score.total ∈ [scoreBand[0], scoreBand[1]] inclusive; else 0.
// ---------------------------------------------------------------------------

function scoreScorePlausible(
  report: ReportPayload,
  rubric: GoldenRubric,
): { score: number; notes: string[] } {
  const total = report.score.total;
  const [lo, hi] = rubric.scoreBand;

  if (total >= lo && total <= hi) {
    return { score: 1, notes: [] };
  }

  return {
    score: 0,
    notes: [
      `scorePlausible: score.total=${total} is outside band [${lo}, ${hi}]`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single fixture's assembled report against its rubric.
 *
 * Pure, synchronous, no DB.
 */
export function scoreFixture(
  report: ReportPayload,
  safeActions: ActionCard[],
  findings: Finding[],
  rubric: GoldenRubric,
  meta: { candidateCount: number; fixtureId: string; appName: string },
): FixtureScore {
  const coverage = scoreFindingsCoverage(findings, rubric);
  const actions = scoreActions(safeActions, rubric);
  const evidence = scoreEvidence(safeActions, rubric);
  const plausible = scoreScorePlausible(report, rubric);

  const score =
    (coverage.score + actions.score + evidence.score + plausible.score) / 4;

  return {
    fixtureId: meta.fixtureId,
    appName: meta.appName,
    findingsCoverage: coverage.score,
    actionScore: actions.score,
    evidenceScore: evidence.score,
    scorePlausible: plausible.score,
    score,
    candidateCount: meta.candidateCount,
    safeCount: safeActions.length,
    notes: [
      ...coverage.notes,
      ...actions.notes,
      ...evidence.notes,
      ...plausible.notes,
    ],
  };
}
