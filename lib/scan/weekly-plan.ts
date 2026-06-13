/**
 * Weekly plan assembler (Cycle 4 Task 11, §10.3) — assembles the founder's
 * "what to do this week" plan from persisted `actions` + `score_snapshots`.
 *
 * Mostly-pure read logic over the DB:
 *   - Load the app's actions; project each row to a WeeklyPlanAction.
 *   - QUEUE: OPEN (status !== "done") actions created WITHIN the weekOf ISO week,
 *     bucketed by effort into the §10.3 horizon mix (quick wins / medium / long play).
 *   - CARRYOVER: ids of OPEN actions created BEFORE the weekOf week (still pending
 *     from an earlier week — they roll forward but don't re-enter this week's queue).
 *   - scoreDeltaLastWeek: latest score_snapshots.total minus the prior snapshot's
 *     total (0 if fewer than 2 snapshots).
 *   - honestyNote (§7.2 rule 5 anti-vanity): if the score rose but reported installs
 *     didn't, a short caution; else null.
 *
 * No LLM, no network beyond the two table reads. The effort-bucketing, this-week /
 * carryover split, score delta, and honesty note are factored out as PURE helpers
 * so they can be unit-tested without a DB.
 *
 * Weeks align with the Task-10 cron: the default `weekOf` is the Monday of the
 * current ISO week, computed by mirroring `isoWeekStart` from weekly-refresh.ts
 * (date-only here vs the cron's full timestamp).
 */

import { serverDb } from "@/lib/db/client";

// ---------------------------------------------------------------------------
// Public types (§10.3 shape)
// ---------------------------------------------------------------------------

/** Projection of an `actions` row for the weekly plan. */
export interface WeeklyPlanAction {
  id: string;
  category: string;
  title: string;
  why: string | null;
  effortMin: number | null;
  deadline: string | null;
  draft: string | null;
  status: string;
  scoreComponent: string | null;
}

export interface WeeklyPlan {
  /** ISO date (Monday of the week, `YYYY-MM-DD`). */
  weekOf: string;
  appId: string;
  queue: {
    quickWins: WeeklyPlanAction[];
    medium: WeeklyPlanAction[];
    longPlay: WeeklyPlanAction[];
  };
  /** Ids of unfinished actions created BEFORE weekOf. */
  carryover: string[];
  /** latest score_snapshots.total − the prior snapshot's total (0 if <2). */
  scoreDeltaLastWeek: number;
  /** §7.2 rule 5 anti-vanity caution, else null. */
  honestyNote: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Effort (minutes) assumed for an action whose `effort_min` is null — the
 * boundary between quick wins and medium, so unestimated cards land in `medium`.
 */
const DEFAULT_EFFORT_MIN = 30;

/** Below this many minutes an action is a "quick win". */
const QUICK_WIN_MAX_MIN = 30;

/** Up to and including this many minutes an action is "medium"; above it, "long play". */
const MEDIUM_MAX_MIN = 120;

/**
 * §7.2 rule 5 anti-vanity caution surfaced when the Discoverability Score rose
 * while reported installs stayed flat or fell.
 */
const HONESTY_NOTE =
  "Your Discoverability Score rose but reported installs haven't moved yet — score reflects surface coverage, not installs.";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

/**
 * Monday (date-only `YYYY-MM-DD`) of the ISO week containing `now`, in UTC.
 *
 * Mirrors `isoWeekStart` in lib/inngest/functions/weekly-refresh.ts exactly so a
 * weekly plan's default `weekOf` lines up with the cron's once-per-week boundary;
 * the only difference is we return the date portion (the cron returns the full
 * ISO timestamp for its `taken_at` lower bound).
 */
export function isoWeekStartDate(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: Sun=0..Sat=6 → days since Monday (Mon=0..Sun=6).
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/**
 * Effort bucket for an action by its `effortMin` (§10.3 horizon mix).
 * null effort is treated as DEFAULT_EFFORT_MIN (→ medium):
 *   quickWins < 30, medium 30..120, longPlay > 120.
 */
export function effortBucket(
  effortMin: number | null,
): "quickWins" | "medium" | "longPlay" {
  const effort = effortMin ?? DEFAULT_EFFORT_MIN;
  if (effort < QUICK_WIN_MAX_MIN) return "quickWins";
  if (effort <= MEDIUM_MAX_MIN) return "medium";
  return "longPlay";
}

function isOpen(action: { status: string }): boolean {
  return action.status !== "done";
}

/**
 * Is `createdAt` (an ISO timestamp) within the ISO week beginning `weekOf`
 * (a `YYYY-MM-DD` Monday)? The window is half-open: [Monday 00:00 UTC, next
 * Monday 00:00 UTC). Earlier creations are carryover; later ones don't exist yet.
 */
export function isInWeek(createdAt: string, weekOf: string): boolean {
  const created = Date.parse(createdAt);
  const start = Date.parse(`${weekOf}T00:00:00.000Z`);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return created >= start && created < end;
}

/**
 * Split OPEN actions into this-week's effort-bucketed queue and the carryover
 * id list. `done` actions are excluded entirely. PURE.
 */
export function splitQueueAndCarryover<
  T extends { id: string; status: string; created_at: string; effort_min: number | null },
>(
  actions: T[],
  weekOf: string,
  project: (action: T) => WeeklyPlanAction,
): { queue: WeeklyPlan["queue"]; carryover: string[] } {
  const queue: WeeklyPlan["queue"] = { quickWins: [], medium: [], longPlay: [] };
  const carryover: string[] = [];

  for (const action of actions) {
    if (!isOpen(action)) continue; // done → excluded from both queue and carryover
    if (isInWeek(action.created_at, weekOf)) {
      queue[effortBucket(action.effort_min)].push(project(action));
    } else {
      // OPEN but created before this week → still pending, rolls forward.
      carryover.push(action.id);
    }
  }

  return { queue, carryover };
}

/**
 * `scoreDeltaLastWeek` from snapshots already ordered NEWEST-first by `taken_at`:
 * latest total − the prior total. 0 when fewer than 2 snapshots. PURE.
 */
export function scoreDelta(
  snapshotsNewestFirst: ReadonlyArray<{ total: number }>,
): number {
  const latest = snapshotsNewestFirst[0];
  const prior = snapshotsNewestFirst[1];
  if (!latest || !prior) return 0;
  return latest.total - prior.total;
}

/**
 * §7.2 rule 5 honesty note from snapshots ordered NEWEST-first.
 * Returns the caution string when BOTH snapshots report installs and the score
 * rose (latest.total > prior.total) while installs did NOT rise (flat or down);
 * otherwise null (including when either install figure is absent). PURE.
 */
export function honestyNote(
  snapshotsNewestFirst: ReadonlyArray<{ total: number; installs_reported: number | null }>,
): string | null {
  const latest = snapshotsNewestFirst[0];
  const prior = snapshotsNewestFirst[1];
  if (!latest || !prior) return null;

  const latestInstalls = latest.installs_reported;
  const priorInstalls = prior.installs_reported;
  const scoreRose = latest.total > prior.total;
  if (!scoreRose || latestInstalls === null || priorInstalls === null) return null;

  const installsRose = latestInstalls > priorInstalls;
  return installsRose ? null : HONESTY_NOTE;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

interface ActionRow {
  id: string;
  category: string;
  title: string;
  why: string | null;
  effort_min: number | null;
  deadline: string | null;
  draft: string | null;
  status: string;
  score_component: string | null;
  created_at: string;
}

function projectAction(row: ActionRow): WeeklyPlanAction {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    why: row.why,
    effortMin: row.effort_min,
    deadline: row.deadline,
    draft: row.draft,
    status: row.status,
    scoreComponent: row.score_component,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble the §10.3 weekly plan for an app from persisted `actions` +
 * `score_snapshots`. `weekOf` defaults to the Monday of the current ISO week
 * (aligned with the Task-10 cron).
 */
export async function assembleWeeklyPlan(
  appId: string,
  weekOf?: string,
): Promise<WeeklyPlan> {
  const week = weekOf ?? isoWeekStartDate(new Date());
  const db = serverDb();

  // All of the app's actions; the queue/carryover split is done in-memory so the
  // bucketing + this-week/earlier logic stays pure and testable.
  const { data: actionRows, error: actionsErr } = await db
    .from("actions")
    .select(
      "id, category, title, why, effort_min, deadline, draft, status, score_component, created_at",
    )
    .eq("app_id", appId);
  if (actionsErr) throw actionsErr;

  // Two most-recent snapshots are enough for both the delta and the honesty note.
  const { data: snapshots, error: snapsErr } = await db
    .from("score_snapshots")
    .select("total, installs_reported, taken_at")
    .eq("app_id", appId)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(2);
  if (snapsErr) throw snapsErr;

  const { queue, carryover } = splitQueueAndCarryover(
    actionRows ?? [],
    week,
    projectAction,
  );

  const snaps = snapshots ?? [];
  return {
    weekOf: week,
    appId,
    queue,
    carryover,
    scoreDeltaLastWeek: scoreDelta(snaps),
    honestyNote: honestyNote(snaps),
  };
}
