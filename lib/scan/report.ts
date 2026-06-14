/**
 * Report payload assembly (§5.6) and persistence.
 *
 * `assembleReport` is pure and deterministic — `generatedAt` is always
 * passed in from the caller so tests can control it.
 *
 * `persistReport` writes `scans.report_payload` via serverDb().
 */

import type { PositioningMirror, Finding, ActionCard } from "@/lib/llm/types";
import type { VerifiedScore } from "@/lib/scan/score-full";
import type { Platform } from "@/lib/scan/router";
import { serverDb } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportPayload {
  mode: Platform;
  generatedAt: string;
  /** Q1 — What you offer */
  whatYouOffer: {
    positioningMirror: PositioningMirror;
  };
  /** Q2 — Who it's for */
  whoItsFor: {
    summary: string;
    signals: string[];
  };
  /** Q3 — Where they are (surfaces + competitor gap) */
  whereTheyAre: {
    surfaces: Array<{ source: string; title: string; url: string }>;
    competitorGap: Array<{
      competitor: string;
      dimension: string;
      them: number;
      you: number;
      /** How the competitor describes itself (from the competitor_gap sheet). */
      positioning?: string;
      /** The specific gap vs the subject (from the competitor_gap sheet). */
      gap?: string;
    }>;
  };
  /** Q4 — What to do this week (bucketed by effort) */
  whatToDoThisWeek: {
    /** effortMin < 30 — §10.3 quick wins */
    quickWins: ActionCard[];
    /** effortMin 30..120 — medium horizon */
    medium: ActionCard[];
    /** effortMin > 120 — long play */
    longPlay: ActionCard[];
  };
  score: VerifiedScore;
}

// ---------------------------------------------------------------------------
// Bucketing helper (§10.3 horizon mix)
// ---------------------------------------------------------------------------

function bucketActions(actions: ActionCard[]): ReportPayload["whatToDoThisWeek"] {
  const quickWins: ActionCard[] = [];
  const medium: ActionCard[] = [];
  const longPlay: ActionCard[] = [];

  for (const action of actions) {
    if (action.effortMin < 30) {
      quickWins.push(action);
    } else if (action.effortMin <= 120) {
      medium.push(action);
    } else {
      longPlay.push(action);
    }
  }

  return { quickWins, medium, longPlay };
}

// ---------------------------------------------------------------------------
// whoItsFor summary builder
// ---------------------------------------------------------------------------

function buildWhoSummary(
  icpSignals: string[],
  reviewsValue: string,
): string {
  const topSignals = icpSignals.slice(0, 3);
  if (topSignals.length === 0) {
    return reviewsValue.length > 0 ? reviewsValue : "Audience signals not yet identified.";
  }
  const signalList = topSignals.join(", ");
  return reviewsValue.length > 0
    ? `Buyers who value ${signalList}. Reviews confirm: "${reviewsValue}".`
    : `Buyers who value ${signalList}.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble a `ReportPayload` from the outputs of the Cycle 3 pipeline.
 *
 * Pure and deterministic — no side effects, no network calls.
 * `generatedAt` is passed in (not `new Date()`) to keep tests reproducible.
 */
export function assembleReport(input: {
  mode: Platform;
  generatedAt: string;
  positioningMirror: PositioningMirror;
  findings: Finding[];
  icpSignals: string[];
  surfaces: Array<{ source: string; title: string; url: string }>;
  competitorGap: Array<{
    competitor: string;
    dimension: string;
    them: number;
    you: number;
    positioning?: string;
    gap?: string;
  }>;
  actions: ActionCard[];
  score: VerifiedScore;
}): ReportPayload {
  const {
    mode,
    generatedAt,
    positioningMirror,
    icpSignals,
    surfaces,
    competitorGap,
    actions,
    score,
  } = input;

  return {
    mode,
    generatedAt,
    whatYouOffer: {
      positioningMirror,
    },
    whoItsFor: {
      summary: buildWhoSummary(icpSignals, positioningMirror.reviewsValue),
      signals: icpSignals.slice(0, 6),
    },
    whereTheyAre: {
      surfaces,
      competitorGap,
    },
    whatToDoThisWeek: bucketActions(actions),
    score,
  };
}

/**
 * Persist a `ReportPayload` to `scans.report_payload` via the service-role
 * Supabase client. Throws on error.
 */
export async function persistReport(
  scanId: string,
  payload: ReportPayload,
): Promise<void> {
  const db = serverDb();
  const { error } = await db
    .from("scans")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ report_payload: payload as unknown as any })
    .eq("id", scanId);

  if (error) {
    throw new Error(`persistReport: failed to write report_payload for scan ${scanId}: ${error.message}`);
  }
}
