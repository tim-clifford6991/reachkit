/**
 * Engagement data layer (Cycle 4 Task 15, §7.3) — the headless read model behind
 * the founder's "are you keeping at it?" surface. The polished UI that renders
 * this is Milestone E; this file is data only (no UI, no LLM, no network beyond
 * two table reads).
 *
 * Three reads over persisted state:
 *   - weeklyStreak: how many CONSECUTIVE recent ISO weeks (ending at the current
 *     week) each have >= 3 verified actions, where a verified action is one
 *     `outcomes` row (Task 14 writes one per verified action). §7.3: "Weekly
 *     streak (>=3 verified actions/week)".
 *   - scoreHistory: the app's score_snapshots totals over time (ascending), for
 *     the trend line.
 *   - engagementSummary: the convenience aggregator the Milestone-E UI calls —
 *     streak + history + the §7.2 rule 5 honesty note.
 *
 * ISO weeks are bucketed by reusing `isoWeekStartDate` from weekly-plan.ts (the
 * Monday `YYYY-MM-DD` of the week, in UTC) — the same boundary as the weekly
 * cron + weekly plan, so a streak week lines up with a plan week. The honesty
 * note reuses weekly-plan.ts's `honestyNote` helper (NOT duplicated): we hand it
 * the two newest snapshots newest-first and it applies the rule.
 *
 * The week-counting is factored out as the PURE `countStreak` helper so it can
 * be unit-tested without a DB.
 */

import { serverDb } from "@/lib/db/client";
import { honestyNote, isoWeekStartDate } from "@/lib/scan/weekly-plan";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** §7.3: a week "counts" toward the streak when it has at least this many verified actions. */
const STREAK_MIN_PER_WEEK = 3;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** One point on the score trend line. */
export interface ScoreHistoryPoint {
  takenAt: string;
  total: number;
}

export interface EngagementSummary {
  /** Consecutive recent ISO weeks (ending at the current week) with >= 3 verified actions. */
  streak: number;
  /** score_snapshots totals, oldest-first. */
  history: ScoreHistoryPoint[];
  /** §7.2 rule 5 anti-vanity caution, else null. */
  honestyNote: string | null;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

/**
 * The ISO-week key (Monday `YYYY-MM-DD`, UTC) of the week immediately before the
 * one keyed by `weekKey`. PURE. `weekKey` is itself a Monday key (as produced by
 * `isoWeekStartDate`), so stepping back 7 days and re-normalising lands on the
 * previous Monday (re-normalising guards against any DST/parse drift).
 */
function previousWeekKey(weekKey: string): string {
  const prior = new Date(Date.parse(`${weekKey}T00:00:00.000Z`) - WEEK_MS);
  return isoWeekStartDate(prior);
}

/**
 * Streak length from per-week verified-action counts, keyed by ISO-week Monday
 * (`isoWeekStartDate`). The streak is the number of CONSECUTIVE weeks, walking
 * back from `currentWeekKey`, that each have >= STREAK_MIN_PER_WEEK actions. If
 * the current week itself is short (or absent), the streak is 0. A week with
 * fewer than the threshold (including a missing/zero week) breaks the run. PURE.
 */
export function countStreak(
  weekCounts: Map<string, number> | Record<string, number>,
  currentWeekKey: string,
): number {
  const get = (key: string): number =>
    weekCounts instanceof Map ? (weekCounts.get(key) ?? 0) : (weekCounts[key] ?? 0);

  let streak = 0;
  let weekKey = currentWeekKey;
  while (get(weekKey) >= STREAK_MIN_PER_WEEK) {
    streak += 1;
    weekKey = previousWeekKey(weekKey);
  }
  return streak;
}

/**
 * Bucket verified-action timestamps into per-ISO-week counts keyed by the week's
 * Monday (`isoWeekStartDate`). PURE.
 */
export function bucketByWeek(observedAts: ReadonlyArray<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const observedAt of observedAts) {
    const key = isoWeekStartDate(new Date(observedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * §7.3 weekly streak: the number of consecutive recent ISO weeks (ending at the
 * current week) that each have >= 3 verified actions for the app. A verified
 * action is an `outcomes` row, bucketed by `observed_at`'s ISO week. 0 if the
 * current week is short.
 */
export async function weeklyStreak(appId: string): Promise<number> {
  const db = serverDb();
  const { data, error } = await db
    .from("outcomes")
    .select("observed_at")
    .eq("app_id", appId);
  if (error) throw error;

  const counts = bucketByWeek((data ?? []).map((row) => row.observed_at));
  return countStreak(counts, isoWeekStartDate(new Date()));
}

/**
 * The app's score_snapshots projected to `{ takenAt, total }`, oldest-first, for
 * the trend line.
 */
export async function scoreHistory(appId: string): Promise<ScoreHistoryPoint[]> {
  const db = serverDb();
  const { data, error } = await db
    .from("score_snapshots")
    .select("taken_at, total")
    .eq("app_id", appId)
    .order("taken_at", { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({ takenAt: row.taken_at, total: row.total }));
}

/**
 * Convenience aggregator for the Milestone-E engagement surface: the weekly
 * streak, the score history, and the §7.2 rule 5 honesty note (computed from the
 * two newest snapshots via weekly-plan.ts's `honestyNote` helper — reused, not
 * duplicated).
 */
export async function engagementSummary(appId: string): Promise<EngagementSummary> {
  const db = serverDb();

  // Two most-recent snapshots are all the honesty note needs (latest vs prior).
  const { data: snaps, error: snapsErr } = await db
    .from("score_snapshots")
    .select("total, installs_reported")
    .eq("app_id", appId)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(2);
  if (snapsErr) throw snapsErr;

  const [streak, history] = await Promise.all([weeklyStreak(appId), scoreHistory(appId)]);

  return {
    streak,
    history,
    honestyNote: honestyNote(snaps ?? []),
  };
}
