/**
 * Plan schedule (PURE) — the singular plan timeline.
 *
 * Merges the founder's tracked actions (the `actions` table, via the action
 * board) with the not-yet-tracked synthesis recommendations (content +
 * distribution plan items), then lays the open work out over WEEKS so the
 * founder always knows what to do now vs. next vs. later.
 *
 * The pacing rules are §11's anti-spam cadence turned into a scheduler:
 *   - a weekly effort budget (solo founders get a few focused hours, not a
 *     backlog dump),
 *   - at most one content piece a week (real writing takes real time),
 *   - outreach capped per week and never two actions on the same venue in the
 *     same week (spacing that also keeps the founder from reading as spam).
 *
 * Deterministic and Date-free: weeks are indexes; the caller maps index → real
 * Monday. Everything here is unit-testable without a DB or clock.
 */

import type { BoardAction } from "@/lib/scan/action-board";

// ---------------------------------------------------------------------------
// Entry model — the common shape every plan surface item normalizes into.
// ---------------------------------------------------------------------------

export interface PlanEntry {
  /** Stable key: the action id when tracked, else "suggest:{title}". */
  key: string;
  /** The action id when this entry is already tracked in `actions`. */
  actionId: string | null;
  kind: "content" | "distribution";
  title: string;
  why: string | null;
  /** Channel for distribution entries (directory | community | …). */
  channel: string | null;
  target: string | null;
  targetUrl: string | null;
  effortMin: number;
  priority: "high" | "medium" | "low";
  predictedDelta: number | null;
  /** Review-required draft already attached to the tracked action, if any. */
  draft: string | null;
  /** True when the entry is already in the actions table (vs. a suggestion). */
  tracked: boolean;
}

export interface ScheduledWeek {
  /** 0 = this week, 1 = next week, … */
  index: number;
  entries: PlanEntry[];
}

// ---------------------------------------------------------------------------
// Normalization inputs (plain shapes, so the client view can call this too)
// ---------------------------------------------------------------------------

export interface ContentPlanItemLike {
  topic: string;
  buyerAngle?: string;
  priority: string;
  estMonthlyVolume?: number;
}

export interface DistributionPlanItemLike {
  action: string;
  channel: string;
  target: string;
  targetUrl?: string;
  why?: string;
  effort: string;
  priority: string;
}

/** Effort → minutes, matching the weekly-plan buckets. */
export const EFFORT_MIN: Record<string, number> = { low: 15, medium: 60, high: 180 };
/** Writing a real content piece is long-play work. */
export const CONTENT_EFFORT_MIN = 150;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const asPriority = (p: string): "high" | "medium" | "low" =>
  p === "high" || p === "low" ? p : "medium";

/**
 * Merge tracked open work with untracked synthesis recommendations.
 * A recommendation whose title matches ANY existing action (open or done) is
 * dropped — it's already tracked or already shipped.
 */
export function mergePlanEntries(args: {
  openActions: BoardAction[];
  /** every action title (any lifecycle state), for suggestion dedupe */
  allActionTitles: ReadonlySet<string>;
  content: ContentPlanItemLike[];
  distribution: DistributionPlanItemLike[];
}): PlanEntry[] {
  const entries: PlanEntry[] = [];

  for (const a of args.openActions) {
    entries.push({
      key: a.id,
      actionId: a.id,
      kind: a.category === "content" ? "content" : "distribution",
      title: a.title,
      why: a.why,
      channel: null,
      target: null,
      targetUrl: a.verifyUrl,
      effortMin: a.effortMin ?? (a.category === "content" ? CONTENT_EFFORT_MIN : EFFORT_MIN.medium!),
      priority: "high", // already chosen by the founder — schedule it first
      predictedDelta: a.predictedDelta,
      draft: a.draft,
      tracked: true,
    });
  }

  for (const c of args.content) {
    if (args.allActionTitles.has(c.topic)) continue;
    entries.push({
      key: `suggest:${c.topic}`,
      actionId: null,
      kind: "content",
      title: c.topic,
      why: c.buyerAngle || null,
      channel: null,
      target: null,
      targetUrl: null,
      effortMin: CONTENT_EFFORT_MIN,
      priority: asPriority(c.priority),
      predictedDelta: null,
      draft: null,
      tracked: false,
    });
  }

  for (const d of args.distribution) {
    if (args.allActionTitles.has(d.action)) continue;
    entries.push({
      key: `suggest:${d.action}`,
      actionId: null,
      kind: "distribution",
      title: d.action,
      why: d.why || null,
      channel: d.channel,
      target: d.target,
      targetUrl: d.targetUrl || null,
      effortMin: EFFORT_MIN[d.effort] ?? EFFORT_MIN.medium!,
      priority: asPriority(d.priority),
      predictedDelta: null,
      draft: null,
      tracked: false,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface ScheduleOptions {
  /** Focused minutes a solo founder can give the plan per week. */
  weeklyBudgetMin?: number;
  /** Hard cap on items per week — a short list gets worked; a long one doesn't. */
  maxPerWeek?: number;
  /** At most this many outreach/distribution actions per week (§11 spacing). */
  maxDistributionPerWeek?: number;
  /** At most this many content pieces per week. */
  maxContentPerWeek?: number;
}

const DEFAULTS: Required<ScheduleOptions> = {
  weeklyBudgetMin: 300,
  maxPerWeek: 4,
  maxDistributionPerWeek: 3,
  maxContentPerWeek: 1,
};

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Scheduling order: tracked work first, then priority, then predicted Δ,
 *  then quick wins before slogs, then title for determinism. */
export function byScheduleOrder(a: PlanEntry, b: PlanEntry): number {
  if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
  const pr = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
  if (pr !== 0) return pr;
  const ad = a.predictedDelta ?? Number.MIN_SAFE_INTEGER;
  const bd = b.predictedDelta ?? Number.MIN_SAFE_INTEGER;
  if (ad !== bd) return bd - ad;
  if (a.effortMin !== b.effortMin) return a.effortMin - b.effortMin;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

/**
 * Greedy earliest-fit: walk entries in schedule order, placing each in the
 * first week with budget + count headroom where its venue isn't already used.
 * An entry that fits nowhere within the horizon lands in a final overflow
 * week rather than being dropped — the plan never hides work.
 */
export function schedulePlan(
  entries: PlanEntry[],
  opts: ScheduleOptions = {},
): ScheduledWeek[] {
  const o = { ...DEFAULTS, ...opts };
  const ordered = [...entries].sort(byScheduleOrder);

  interface WeekState {
    entries: PlanEntry[];
    usedMin: number;
    distribution: number;
    content: number;
    hosts: Set<string>;
  }
  const weeks: WeekState[] = [];
  const weekAt = (i: number): WeekState => {
    while (weeks.length <= i) weeks.push({ entries: [], usedMin: 0, distribution: 0, content: 0, hosts: new Set() });
    return weeks[i]!;
  };

  const fits = (w: WeekState, e: PlanEntry): boolean => {
    if (w.entries.length >= o.maxPerWeek) return false;
    // A single entry longer than the whole budget still has to land somewhere —
    // it fits any week it would start empty-handed.
    if (w.usedMin + e.effortMin > o.weeklyBudgetMin && w.entries.length > 0) return false;
    if (e.kind === "distribution" && w.distribution >= o.maxDistributionPerWeek) return false;
    if (e.kind === "content" && w.content >= o.maxContentPerWeek) return false;
    const host = hostOf(e.targetUrl);
    if (host && w.hosts.has(host)) return false;
    return true;
  };

  for (const e of ordered) {
    let i = 0;
    while (!fits(weekAt(i), e)) i++;
    const w = weekAt(i);
    w.entries.push(e);
    w.usedMin += e.effortMin;
    if (e.kind === "distribution") w.distribution++;
    else w.content++;
    const host = hostOf(e.targetUrl);
    if (host) w.hosts.add(host);
  }

  return weeks
    .map((w, index) => ({ index, entries: w.entries }))
    .filter((w) => w.entries.length > 0);
}

// ---------------------------------------------------------------------------
// Day placement — the calendar layer
// ---------------------------------------------------------------------------

export interface ScheduledDay {
  /** Local date, "YYYY-MM-DD". */
  date: string;
  entries: PlanEntry[];
}

/** Local YYYY-MM-DD (no UTC shift). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local Monday of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

/**
 * Spread each scheduled week's entries across its calendar days — the plan as
 * a calendar, starting TODAY. Week 0 only uses today..Sunday (never schedules
 * into the past); later weeks use all seven days. One entry per day until a
 * week has more entries than days, then round-robin. Deterministic for a given
 * `today`, so the calendar doesn't reshuffle on every render.
 */
export function scheduleToDays(weeks: ScheduledWeek[], today: Date): ScheduledDay[] {
  const monday0 = mondayOf(today);
  const byDate = new Map<string, PlanEntry[]>();

  for (const week of weeks) {
    const weekMonday = new Date(monday0);
    weekMonday.setDate(monday0.getDate() + week.index * 7);

    // Candidate days: week 0 starts at today; later weeks start on Monday.
    const startOffset = week.index === 0 ? (today.getDay() + 6) % 7 : 0;
    const days: Date[] = [];
    for (let d = startOffset; d < 7; d++) {
      const day = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + d);
      days.push(day);
    }

    week.entries.forEach((entry, i) => {
      const day = days[i % days.length]!;
      const key = localDateKey(day);
      const list = byDate.get(key) ?? [];
      list.push(entry);
      byDate.set(key, list);
    });
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));
}
