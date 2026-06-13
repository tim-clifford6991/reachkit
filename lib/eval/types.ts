/**
 * Types for the golden-set eval harness (Task 14 — R1 quality gate).
 *
 * Each GoldenFixture carries its own canned data for a specific reference app.
 * The harness runs the REAL deterministic quality gates over these fixtures to
 * produce app-specific scores rather than synthetic HabitKit scores.
 */

import type { Finding, ActionCard } from "@/lib/llm/types";
import type { PositioningMirror } from "@/lib/llm/types";
import type { PreliminaryFacts } from "@/lib/scan/types";

// ---------------------------------------------------------------------------
// GoldenRubric — per-fixture quality expectations
// ---------------------------------------------------------------------------

export interface GoldenRubric {
  /**
   * Categories that must each be represented by ≥1 SURVIVING safe action
   * (post-Critic + post-§11). Doubles as the per-category action FLOOR: a
   * pipeline regression that zeroes a whole category (e.g. the §11 cadence
   * cap silently dropping every outreach card) fails the floor.
   *
   * Also the basis of the pipeline-driven `categoryCoverage` sub-score —
   * NOT scored against the fixture's static `findings` (which would be
   * tautological), but against the actions that actually survive the gates.
   */
  expectedActiveCategories: Array<"content" | "outreach" | "seo_aso">;
  /**
   * Keywords (case-insensitive) that must appear in the SURVIVING safe
   * actions' text (title + why + draft + evidence excerpts). Pipeline-driven:
   * if the gates drop the actions that carried a keyword, coverage falls.
   */
  expectedKeywords: string[];
  /** Minimum number of actions that must survive the critic + safety gates. */
  minActions: number;
  /** When true: evidenceScore checks that all safeActions have ≥2 evidence items. */
  requireEvidence: boolean;
  /** [min, max] — report.score.total must fall within this band (inclusive). */
  scoreBand: [number, number];
}

// ---------------------------------------------------------------------------
// GoldenFixture — one reference app's canned inputs + rubric
// ---------------------------------------------------------------------------

export interface GoldenFixture {
  /** Fixture identifier (slug of the app name). */
  id: string;
  /** Human-readable app name. */
  appName: string;
  /** Platform mode. */
  mode: "ios" | "android" | "web";
  /** Store URL used to seed the apps table. */
  storeUrl: string;

  // --- Canned pipeline inputs ---
  facts: PreliminaryFacts;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  candidateActions: ActionCard[];

  // --- Report assembly inputs (passed directly to assembleReport) ---
  icpSignals: string[];
  surfaces: Array<{ source: string; title: string; url: string }>;
  competitorGap: Array<{
    competitor: string;
    dimension: string;
    them: number;
    you: number;
  }>;

  // --- Quality rubric ---
  rubric: GoldenRubric;
}

// ---------------------------------------------------------------------------
// FixtureScore — per-fixture scoring result
// ---------------------------------------------------------------------------

export interface FixtureScore {
  fixtureId: string;
  appName: string;

  // Sub-scores, each 0..1
  /**
   * PIPELINE-DRIVEN coverage of the SURVIVING safe actions (post-Critic +
   * post-§11) against the rubric: mean of (a) the per-category action floor
   * fraction and (b) keyword coverage in the surviving actions' text. Replaces
   * the old tautological findings-vs-rubric score.
   */
  categoryCoverage: number;
  actionScore: number;
  evidenceScore: number;
  scorePlausible: number;

  /** Mean of the four sub-scores. */
  score: number;

  /**
   * Hard per-category floor: true iff EVERY expectedActiveCategory has ≥1
   * surviving safe action. The eval gate asserts this is true for all fixtures.
   */
  categoryFloorMet: boolean;
  /** Categories from the rubric that have ZERO surviving safe actions. */
  missingCategories: Array<"content" | "outreach" | "seo_aso">;

  /** Number of candidate actions provided to the critic gate. */
  candidateCount: number;
  /** Number of actions that survived both gates. */
  safeCount: number;

  /** Explanatory notes for any sub-score < 1. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// GoldenSetResult — overall harness result
// ---------------------------------------------------------------------------

export interface GoldenSetResult {
  perFixture: FixtureScore[];
  /** Mean of per-fixture scores. Must be ≥ 0.7 to pass R1. */
  mean: number;
}
