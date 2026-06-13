/**
 * Pure, deterministic fixture scorer for the golden-set eval harness.
 *
 * scoreFixture() takes the assembled report + the SURVIVING safe actions (the
 * actual post-Critic + post-§11 pipeline output) + the rubric and returns a
 * FixtureScore with four sub-scores (each 0..1) and their mean.
 *
 * NO DB, NO async — pure and deterministic.
 *
 * De-tautologized (Cycle 4 Task 17b): coverage is scored against the SURVIVING
 * safeActions — real pipeline output — NOT against each fixture's hand-authored
 * static `findings` (which a rubric written to match them scored tautologically
 * at 1.000). A regression that drops actions or a whole action category now
 * lowers the coverage sub-score and trips the per-category floor.
 */

import type { ReportPayload } from "@/lib/scan/report";
import type { ActionCard } from "@/lib/llm/types";
import type { GoldenRubric, FixtureScore } from "@/lib/eval/types";

type Category = "content" | "outreach" | "seo_aso";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The searchable text of a single surviving action: title + why + draft +
 * every evidence excerpt, lower-cased. This is what keyword coverage is scored
 * against — so a keyword only "covered" because it lived in a card the §11 caps
 * dropped no longer counts.
 */
function actionText(a: ActionCard): string {
  return [a.title, a.why, a.draft ?? "", ...a.evidence.map((e) => e.excerpt)]
    .join(" ")
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Per-category action floor (the §11-cap-zeroes-a-category regression catcher)
//
// For each rubric.expectedActiveCategory, require ≥1 SURVIVING safe action.
// Returns the fraction of expected categories that are covered + the explicit
// list of any that are missing. A whole missing category drives this toward 0.
// ---------------------------------------------------------------------------

function evaluateCategoryFloor(
  safeActions: ActionCard[],
  expected: Category[],
): { fraction: number; missing: Category[] } {
  const present = new Set(safeActions.map((a) => a.category));
  const missing = expected.filter((c) => !present.has(c));
  const fraction =
    expected.length === 0 ? 1 : (expected.length - missing.length) / expected.length;
  return { fraction, missing };
}

// ---------------------------------------------------------------------------
// Sub-score: categoryCoverage (PIPELINE-DRIVEN — replaces findingsCoverage)
// Mean of:
//   (a) per-category action floor fraction over the SURVIVING safe actions
//   (b) fraction of expectedKeywords found in the SURVIVING safe actions' text
// ---------------------------------------------------------------------------

function scoreCategoryCoverage(
  safeActions: ActionCard[],
  rubric: GoldenRubric,
): { score: number; missing: Category[]; notes: string[] } {
  const notes: string[] = [];

  // (a) per-category floor over surviving actions
  const floor = evaluateCategoryFloor(safeActions, rubric.expectedActiveCategories);
  if (floor.missing.length > 0) {
    notes.push(
      `categoryCoverage: NO surviving safe action for category: ${floor.missing.join(", ")} ` +
        `(per-category floor failed — a §11 cap or the Critic dropped the whole category)`,
    );
  }

  // (b) keyword coverage over the surviving actions' text
  const allText = safeActions.map(actionText).join(" ");
  const expectedKws = rubric.expectedKeywords;
  const missedKws = expectedKws.filter((kw) => !allText.includes(kw.toLowerCase()));
  const kwFraction =
    expectedKws.length === 0
      ? 1
      : (expectedKws.length - missedKws.length) / expectedKws.length;

  if (missedKws.length > 0) {
    notes.push(
      `categoryCoverage: keywords absent from surviving safe actions: ${missedKws.join(", ")}`,
    );
  }

  return { score: (floor.fraction + kwFraction) / 2, missing: floor.missing, notes };
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
 * Coverage is computed from the SURVIVING `safeActions` (real pipeline output),
 * NOT the static fixture `findings` — so it is no longer tautological.
 *
 * Pure, synchronous, no DB.
 */
export function scoreFixture(
  report: ReportPayload,
  safeActions: ActionCard[],
  rubric: GoldenRubric,
  meta: { candidateCount: number; fixtureId: string; appName: string },
): FixtureScore {
  const coverage = scoreCategoryCoverage(safeActions, rubric);
  const actions = scoreActions(safeActions, rubric);
  const evidence = scoreEvidence(safeActions, rubric);
  const plausible = scoreScorePlausible(report, rubric);

  const score =
    (coverage.score + actions.score + evidence.score + plausible.score) / 4;

  return {
    fixtureId: meta.fixtureId,
    appName: meta.appName,
    categoryCoverage: coverage.score,
    actionScore: actions.score,
    evidenceScore: evidence.score,
    scorePlausible: plausible.score,
    score,
    categoryFloorMet: coverage.missing.length === 0,
    missingCategories: coverage.missing,
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
