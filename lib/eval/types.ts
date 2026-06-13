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
  /** Finding categories that must appear in the output findings. */
  expectedFindingCategories: Array<"content" | "outreach" | "seo_aso">;
  /** Keywords (case-insensitive) that must appear in at least one finding claim. */
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
  findingsCoverage: number;
  actionScore: number;
  evidenceScore: number;
  scorePlausible: number;

  /** Mean of the four sub-scores. */
  score: number;

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
