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
import { horizonForEntry, type Horizon } from "@/lib/scan/plan-horizon";

// ---------------------------------------------------------------------------
// Entry model — the common shape every plan surface item normalizes into.
// ---------------------------------------------------------------------------

export interface PlanEntry {
  /** Stable key: the action id when tracked, "suggest:{title}", or "post:{date}". */
  key: string;
  /** The action id when this entry is already tracked in `actions`. */
  actionId: string | null;
  /** content = long-form article for their own site (weekly long play);
   *  post = the DAILY short social post (X first) — content as a habit;
   *  distribution = targeted venue actions, §11-spaced. */
  kind: "content" | "distribution" | "post";
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
  /** The evidence line this recommendation cites — never a black box. */
  evidence: string | null;
  /** N (2026-07-24) grounding context — WHAT this action targets + WHO it models,
   *  surfaced so a plan row is never a bare instruction. Content entries carry the
   *  gap keywords they target + the rival pages that already win them; empty for
   *  entries without that grounding (distribution/post/legacy). */
  targetKeywords?: string[];
  exemplars?: { domain: string; url: string }[];
  /** Pinned calendar day ("YYYY-MM-DD"): when set, the entry lands on exactly
   *  this day (bypassing the pacer) — e.g. "generate more for today". Null =
   *  paced. Only tracked actions can be pinned. */
  scheduledFor?: string | null;
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
  evidence?: string;
  /** N: grounding — the gap keywords this piece targets + the rival pages winning them. */
  targetKeywords?: string[];
  competitorExemplars?: { domain: string; url: string; position?: number }[];
}

export interface DistributionPlanItemLike {
  action: string;
  channel: string;
  target: string;
  targetUrl?: string;
  why?: string;
  effort: string;
  priority: string;
  evidence?: string;
}

/** Effort → minutes, matching the weekly-plan buckets. */
export const EFFORT_MIN: Record<string, number> = { low: 8, medium: 20, high: 45 };
/** Writing a real content piece is long-play work. */
export const CONTENT_EFFORT_MIN = 45;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const asPriority = (p: string): "high" | "medium" | "low" =>
  p === "high" || p === "low" ? p : "medium";

/**
 * Merge tracked open work with untracked synthesis recommendations.
 * A recommendation whose title matches ANY existing action (open or done) is
 * dropped — it's already tracked or already shipped.
 */
/** Tracked daily posts are titled "X post (YYYY-MM-DD): …" so they stay
 *  distinguishable from articles/distribution in the actions table. */
export const DAILY_POST_PREFIX = "X post (";

export function mergePlanEntries(args: {
  openActions: BoardAction[];
  /** every action title (any lifecycle state), for suggestion dedupe */
  allActionTitles: ReadonlySet<string>;
  content: ContentPlanItemLike[];
  distribution: DistributionPlanItemLike[];
}): PlanEntry[] {
  const entries: PlanEntry[] = [];

  for (const a of args.openActions) {
    // Tracked daily posts belong to their calendar day (addDailyPosts), not
    // the weekly schedule — merging them here would misfile a 10-minute post
    // as a long-form article and eat the 1-content-piece-a-week slot.
    if (a.title.startsWith(DAILY_POST_PREFIX)) continue;
    entries.push({
      key: a.id,
      actionId: a.id,
      // Only genuine OUTREACH (reach out to a venue/person) is a distribution entry
      // — that's what earns the platform/email "pitch" draft. On-site work (content
      // AND seo_aso, e.g. "publish keyword-targeted pages") is a CONTENT entry, so it
      // gets a content draft instead of a nonsensical floating outreach email.
      kind: a.category === "outreach" ? "distribution" : "content",
      title: a.title,
      why: a.why,
      // A tracked action's structured target (Task: ActionTarget) drives routing;
      // fall back to the legacy title-derived route (null channel/target) + verifyUrl
      // when the action predates targets or is an on-site task.
      channel: a.target?.channel ?? null,
      target: a.target?.label ?? null,
      targetUrl: a.target?.url ?? a.verifyUrl,
      effortMin: a.effortMin ?? (a.category === "content" ? CONTENT_EFFORT_MIN : EFFORT_MIN.medium!),
      priority: "high", // already chosen by the founder — schedule it first
      predictedDelta: a.predictedDelta,
      draft: a.draft,
      tracked: true,
      evidence: null,
      scheduledFor: a.scheduledFor ?? null,
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
      evidence: c.evidence || null,
      // N: the keywords this piece targets + the rival pages that already win them.
      targetKeywords: c.targetKeywords ?? [],
      exemplars: (c.competitorExemplars ?? []).map((e) => ({ domain: e.domain, url: e.url })),
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
      evidence: d.evidence || null,
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

const HORIZON_ORDER: Horizon[] = ["short", "medium", "long"];

/**
 * The day's headline 3: one entry per impact horizon (short/medium/long, in
 * that order) where the day has one, backfilled from the remaining
 * highest-priority entries when a horizon is empty. PURE + deterministic
 * (relies on `byScheduleOrder`'s total ordering, which always tie-breaks on
 * title). Never more than 3, never fewer than `min(3, entries.length)`.
 */
export function topThreeByHorizon(entries: PlanEntry[]): PlanEntry[] {
  const byHorizon = new Map<Horizon, PlanEntry[]>(HORIZON_ORDER.map((h) => [h, []]));
  for (const e of entries) byHorizon.get(horizonForEntry(e))!.push(e);
  for (const h of HORIZON_ORDER) byHorizon.get(h)!.sort(byScheduleOrder);

  const picked: PlanEntry[] = [];
  const pickedKeys = new Set<string>();
  for (const h of HORIZON_ORDER) {
    const top = byHorizon.get(h)![0];
    if (top) {
      picked.push(top);
      pickedKeys.add(top.key);
    }
  }

  if (picked.length < 3) {
    const remaining = entries.filter((e) => !pickedKeys.has(e.key)).sort(byScheduleOrder);
    for (const e of remaining) {
      if (picked.length >= 3) break;
      picked.push(e);
      pickedKeys.add(e.key);
    }
  }

  return picked.slice(0, 3);
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

/**
 * Drop each pinned entry onto its exact `scheduledFor` day, bypassing the
 * pacer — the founder asked for it on that day (e.g. "generate more for
 * today"). A pin in the past is clamped to today (we never schedule into the
 * past, matching `scheduleToDays`). Creates the day if absent, keeps the list
 * date-sorted, and dedupes by key. PURE.
 */
export function placePinnedEntries(days: ScheduledDay[], pinned: PlanEntry[], today: Date): ScheduledDay[] {
  if (pinned.length === 0) return days;
  const todayKey = localDateKey(today);
  const byDate = new Map<string, PlanEntry[]>(days.map((d) => [d.date, [...d.entries]]));
  for (const e of pinned) {
    const day = e.scheduledFor && e.scheduledFor >= todayKey ? e.scheduledFor : todayKey;
    const list = byDate.get(day) ?? [];
    if (!list.some((x) => x.key === e.key)) list.push(e);
    byDate.set(day, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));
}

// ---------------------------------------------------------------------------
// Daily posts — content as a habit, not an event.
// ---------------------------------------------------------------------------

export interface PostAngle {
  /** Short display title for the calendar chip. */
  title: string;
  /** The angle handed to the draft engine. */
  angle: string;
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Build the rotating pool of daily X-post angles from what the scan already
 * knows: the content plan's demand-led topics and buyer angles, the
 * distribution plan's evidence ("why buyers are there"), and evergreen
 * build-in-public beats. PURE and deterministic — the founder can post to
 * their heart's content and every prompt is grounded in their own market.
 */
export function buildDailyPostAngles(s: {
  category: string;
  contentPlan: ContentPlanItemLike[];
  distribution?: DistributionPlanItemLike[];
}): PostAngle[] {
  const pool: PostAngle[] = [];

  for (const c of s.contentPlan) {
    pool.push({
      title: trunc(`Tip: ${c.topic}`, 130),
      angle: `Share ONE practical, non-obvious tip on "${c.topic}"${c.buyerAngle ? ` (audience: ${c.buyerAngle})` : ""}. Teach something real in 2-3 sentences.`,
    });
    if (c.buyerAngle) {
      pool.push({
        title: trunc(`Pain point: ${c.buyerAngle}`, 130),
        angle: `Describe the pain "${c.buyerAngle}" the way a buyer would say it, then one insight that helps — related to ${c.topic}.`,
      });
    }
  }

  for (const d of s.distribution ?? []) {
    if (d.why) {
      pool.push({
        title: trunc(`Insight: ${d.why}`, 130),
        angle: `Turn this market observation into a useful post: "${d.why}" (context: ${d.target}). No pitch — share the insight.`,
      });
    }
  }

  // Evergreen build-in-public beats — always available, even on a thin plan.
  pool.push(
    { title: "Build in public: this week's progress", angle: `Share what you shipped or learned this week building a ${s.category} product. Specific, honest, no humblebrag.` },
    { title: "Behind the scenes: a decision you made", angle: `Explain one real product/positioning decision you made recently for your ${s.category} product and why.` },
    { title: "Answer a buyer question", angle: `Answer one question buyers of ${s.category} tools always ask — the answer you'd give a friend.` },
  );

  return pool;
}

/** Rolling roadmap horizon: the founder always sees the next 30 days planned.
 *  Derived from `today` on every build, so finishing a day automatically
 *  extends the horizon by one — the roadmap never shrinks. */
export const DAILY_POST_HORIZON_DAYS = 30;

/**
 * Fill EVERY day from today through the horizon with a daily post entry —
 * content is the founder's daily habit; articles and distribution land around
 * it. Days whose dated post is already tracked (the founder queued/did it)
 * are skipped via `postedDates`. Posts go FIRST in each day: the 10-minute
 * ritual before the bigger rocks. Mutates nothing; returns a new day list.
 */
export function addDailyPosts(
  days: ScheduledDay[],
  angles: PostAngle[],
  today: Date,
  opts: { horizonDays?: number; postedDates?: ReadonlySet<string> } = {},
): ScheduledDay[] {
  if (angles.length === 0) return days;
  const horizonDays = opts.horizonDays ?? DAILY_POST_HORIZON_DAYS;
  const posted = opts.postedDates ?? new Set<string>();

  const byDate = new Map(days.map((d) => [d.date, [...d.entries]]));

  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = localDateKey(day);
    if (posted.has(key)) continue;
    const angle = angles[i % angles.length]!;
    const entry: PlanEntry = {
      key: `post:${key}`,
      actionId: null,
      kind: "post",
      title: angle.title,
      why: angle.angle,
      channel: "x",
      target: "X (Twitter)",
      targetUrl: null,
      effortMin: 3,
      priority: "high",
      predictedDelta: null,
      draft: null,
      tracked: false,
      evidence: null,
    };
    const list = byDate.get(key) ?? [];
    list.unshift(entry); // the daily ritual leads the day
    byDate.set(key, list);
  }

  // Scheduled days beyond the horizon pass through untouched (already in byDate).
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));
}

// ---------------------------------------------------------------------------
// Thread replies — quick-win entries built from REAL demand threads (community
// pockets a buyer is already posting in). Never invented: an empty/absent
// `threads` input yields zero entries, and the plan renders exactly as before.
// ---------------------------------------------------------------------------

/** The minimal thread shape the builder needs — a loose match to
 *  `DemandPocket["topThreads"]` entries so callers can pass them straight through. */
export interface ThreadReplyInput {
  title: string;
  url: string;
  intent?: number;
}

/** A quick-win community reply is always this cheap — reading + a genuine
 *  reply, not a research project. */
export const THREAD_REPLY_EFFORT_MIN = 4;

/**
 * Turn the highest-intent demand threads into `PlanEntry` quick-win replies.
 * PURE: sorts by intent (desc), drops threads without a real url/title, dedupes
 * by url, skips any thread whose derived title already matches a tracked/shipped
 * action (`excludeTitles`), and caps at `limit`.
 */
export function buildThreadReplyEntries(
  threads: ThreadReplyInput[],
  opts: { limit?: number; excludeTitles?: ReadonlySet<string> } = {},
): PlanEntry[] {
  const limit = opts.limit ?? 5;
  const excludeTitles = opts.excludeTitles ?? new Set<string>();

  const ranked = [...threads]
    .filter((t) => !!t.url && !!t.title)
    .sort((a, b) => (b.intent ?? 0) - (a.intent ?? 0));

  const entries: PlanEntry[] = [];
  const seenUrls = new Set<string>();
  for (const t of ranked) {
    if (entries.length >= limit) break;
    if (seenUrls.has(t.url)) continue;
    const title = `Reply to: ${trunc(t.title, 100)}`;
    if (excludeTitles.has(title)) continue;
    seenUrls.add(t.url);
    entries.push({
      key: `reply:${t.url}`,
      actionId: null,
      kind: "distribution",
      title,
      why: "A buyer is describing your problem unprompted — a genuine, helpful reply puts you in front of them.",
      channel: "community",
      target: null,
      targetUrl: t.url,
      effortMin: THREAD_REPLY_EFFORT_MIN,
      priority: "high",
      predictedDelta: null,
      draft: null,
      tracked: false,
      evidence: t.url,
    });
  }
  return entries;
}

/**
 * Inject at most `maxPerDay` (default 1) thread-reply entries into each day's
 * short slot — right after the daily post ritual, ahead of the rest of the
 * day's work, since a reply is the quickest win available. Consumes `replies`
 * in order (freshest/highest-intent first → today), so once the queue runs
 * out later days pass through untouched. Mutates nothing.
 */
export function addThreadReplies(
  days: ScheduledDay[],
  replies: PlanEntry[],
  opts: { maxPerDay?: number } = {},
): ScheduledDay[] {
  if (replies.length === 0) return days;
  const maxPerDay = opts.maxPerDay ?? 1;
  const queue = [...replies];

  return days.map((day) => {
    if (queue.length === 0) return day;
    const take = queue.splice(0, maxPerDay);
    const postIdx = day.entries.findIndex((e) => e.kind === "post");
    const entries = [...day.entries];
    entries.splice(postIdx === -1 ? 0 : postIdx + 1, 0, ...take);
    return { ...day, entries };
  });
}

// ---------------------------------------------------------------------------
// The whole build, one call — shared by the plan page and the dashboard.
// ---------------------------------------------------------------------------

export interface PlanBoardLike {
  open: BoardAction[];
  retry: BoardAction[];
  verifying: BoardAction[];
  done: BoardAction[];
}

/**
 * Build the founder's rolling 30-day plan: merge tracked actions with the
 * synthesis recommendations, pace them (§11-as-scheduler), place them on
 * calendar days starting today, and fill every day with the daily post habit.
 * PURE + deterministic for a given `today` — recomputed on every render, so
 * the roadmap always extends 30 days ahead of wherever the founder is.
 */
export function buildPlanDays(args: {
  board: PlanBoardLike;
  category: string;
  content: ContentPlanItemLike[];
  distribution: DistributionPlanItemLike[];
  today: Date;
}): ScheduledDay[] {
  const allActions = [...args.board.open, ...args.board.retry, ...args.board.verifying, ...args.board.done];
  const allActionTitles = new Set(allActions.map((a) => a.title));
  const entries = mergePlanEntries({
    openActions: [...args.board.open, ...args.board.retry],
    allActionTitles,
    content: args.content,
    distribution: args.distribution,
  });
  // Pinned entries (scheduledFor set — e.g. "generate more for today") land on
  // their exact day; everything else is paced. Partition so the pacer never
  // also places a pinned entry.
  const pinned = entries.filter((e) => e.scheduledFor);
  const unpinned = entries.filter((e) => !e.scheduledFor);
  const scheduled = placePinnedEntries(scheduleToDays(schedulePlan(unpinned), args.today), pinned, args.today);

  const postedDates = new Set(
    allActions
      .map((a) => /^X post \((\d{4}-\d{2}-\d{2})\)/.exec(a.title)?.[1])
      .filter((d): d is string => !!d),
  );
  const angles = buildDailyPostAngles({
    category: args.category,
    contentPlan: args.content,
    distribution: args.distribution,
  });
  return addDailyPosts(scheduled, angles, args.today, { postedDates });
}

/**
 * The plan page's build: `buildPlanDays` PLUS buyer-intent thread-reply
 * quick-wins woven into each day. Kept SEPARATE from `buildPlanDays` so the
 * dashboard's week preview (which imports `buildPlanDays` but never renders
 * replies) doesn't pull the reply builders into its bundle chunk. PURE.
 * `threadReplies` is cache-warm demand data (`community.pockets[].topThreads`);
 * omitted or empty means no reply entries, never a fabricated one.
 */
export function buildPlanDaysWithReplies(args: {
  board: PlanBoardLike;
  category: string;
  content: ContentPlanItemLike[];
  distribution: DistributionPlanItemLike[];
  today: Date;
  threadReplies?: ThreadReplyInput[];
}): ScheduledDay[] {
  const days = buildPlanDays(args);
  if (!args.threadReplies?.length) return days;
  const allActionTitles = new Set(
    [...args.board.open, ...args.board.retry, ...args.board.verifying, ...args.board.done].map((a) => a.title),
  );
  const replyEntries = buildThreadReplyEntries(args.threadReplies, { excludeTitles: allActionTitles });
  return addThreadReplies(days, replyEntries, { maxPerDay: 1 });
}
