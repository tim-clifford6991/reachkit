// SPEC §7 *The week is committed on Monday*: the Monday job's judge and commit steps, either side of the research steps
// (`src/lib/generate/research-queue.ts`), and the record of what the week was short of. A new site's first week is
// researched and recorded the same way (SPEC §5).
import { WEEK_PLAN } from "@/lib/config/constants";
import type { Checks, WeekRow } from "@/lib/generate/research-queue";
import { judgeWeek, planRefreshes, planWeek } from "@/lib/opportunities";
import { weekCandidates } from "@/lib/opportunities/plan";
import { opportunityStore, type OpportunityRow } from "@/lib/opportunities/store";
import type { PlanReason } from "@/lib/opportunities/types";
import { claimOpsEvent, opsEventRead, replaceOpsEvent } from "@/lib/ops/events";
import type { TopUpRecord } from "@/lib/opportunities/derive/top-up";

const weekRows = (rows: readonly OpportunityRow[]): WeekRow[] => rows.map((row) => ({ id: row.id, target_query: row.target_query }));

/** What the pass's top-up offered, offered from searches it bought, and wrote as rows, from the pass's stored supply row; `null` where none is stored. */
async function topUpOf(siteId: string, scanId: string | undefined): Promise<{ offered: number; bought: number; kept: number } | null> {
  if (scanId === undefined) return null;
  const record = (JSON.parse((await opsEventRead("supply_pass", siteId, scanId)) ?? "{}") as { topUp?: TopUpRecord }).topUp;
  if (record === undefined) return null;
  const sources = Object.values(record.sources);
  return { offered: sources.reduce((n, s) => n + s.offered, 0), bought: record.sources[2].offered, kept: sources.reduce((n, s) => n + s.added, 0) };
}

/** The week's verdicts and its refreshes, then the `WEEK_RESEARCH.rowsMax` best-ranked writable rows the commit checks. */
export async function judgeWeekRows(a: { siteId: string; weekStart: string; now: Date }): Promise<WeekRow[]> {
  await judgeWeek({ siteId: a.siteId, week: a.weekStart });
  // The live pages due a refresh are planned before readiness is recorded on them.
  await planRefreshes({ siteId: a.siteId, at: a.now });
  return weekRows(await weekCandidates(a.siteId, a.now));
}

/** A new site's best rows, their own target SERPs posted on the normal queue right after derive; none once a week is committed. */
export async function postFirstWeek(a: { siteId: string; scanId: string; now: Date }): Promise<WeekRow[]> {
  if ((await opportunityStore().plannedRows(a.siteId)).length > 0) return [];
  const rows = weekRows(await weekCandidates(a.siteId, a.now));
  const { askWeekResearch, COLLECT } = await import("@/lib/generate/research-queue");
  await askWeekResearch({ ...a, rows, waitMs: COLLECT.askMs });
  return rows;
}

/** Commits the week from the checks, then records once per site and week what it was short of (SPEC §7); a re-run's commit holds the week, so its record replaces the one held. */
export async function commitWeek(a: { siteId: string; scanId?: string; weekStart: string; now: Date; rows: readonly WeekRow[]; checks: Checks; again?: boolean }): Promise<void> {
  // The pass plans a full week from its first unwritten date, and records the span it planned.
  const week = await planWeek(a.siteId, { now: a.now, record: true, days: WEEK_PLAN.days, research: new Map(a.checks) });
  await recordWeek(a, week, week.rested, { from: week.from, days: week.days });
}

/** The first week's record, from the rows committed, whichever commit made it: the first draft's from its own date, or
 *  `planFirstWeek`. A checked row neither committed nor resting is not counted. */
export async function recordFirstWeek(a: { siteId: string; now: Date; rows: readonly WeekRow[]; checks: Checks }): Promise<void> {
  if (a.rows.length === 0) return;
  const store = opportunityStore(), held = await store.plannedRows(a.siteId), planned = new Set(held.map((row) => row.id));
  const week = held.map((row) => ({ opportunityId: row.id, plannedFor: row.planned_for ?? null, reason: row.plan_reason ?? {} }));
  const others = await Promise.all(a.rows.filter((row) => !planned.has(row.id)).map((row) => store.byId(row.id)));
  const rested = others.flatMap((row) => (row?.rest_until != null && Date.parse(row.rest_until) > a.now.getTime() ? [{ opportunityId: row.id, short: [] }] : []));
  // The first week runs to the first Monday from its first date: a Wednesday 5 days, a Monday 7.
  const first = week.flatMap((entry) => entry.plannedFor ?? []).sort()[0], days = first === undefined ? WEEK_PLAN.days : (8 - new Date(`${first}T00:00:00Z`).getUTCDay()) % 7 || WEEK_PLAN.days;
  await recordWeek({ ...a, weekStart: a.now.toISOString().slice(0, 10) }, week, rested, { from: first ?? a.now.toISOString().slice(0, 10), days });
}

async function recordWeek(a: { siteId: string; scanId?: string; weekStart: string; again?: boolean; rows: readonly WeekRow[]; checks: Checks }, week: readonly { opportunityId: string; plannedFor: string | null; reason: Pick<PlanReason, "research"> }[], rested: readonly { opportunityId: string; short: string[] }[], span: { from: string; days: number }): Promise<void> {
  const marks = [...week.flatMap((entry) => entry.reason.research ?? []), ...rested.map((r) => ({ state: "short" as const, short: r.short }))];
  const count = (state: string) => marks.filter((mark) => mark.state === state).length;
  const short: Record<string, number> = {};
  for (const part of marks.flatMap((mark) => (mark.state === "short" ? (mark.short ?? []) : []))) short[part] = (short[part] ?? 0) + 1;
  const spares = week.filter((entry) => entry.plannedFor === null);
  const read = {
    checked: a.checks.length,
    met: count("met"),
    at_margin: count("at_margin"),
    queued: count("queued"),
    short: { rows: count("short"), ...short },
    rested: rested.map((r) => ({ id: r.opportunityId, short: r.short })),
    top_up: await topUpOf(a.siteId, a.scanId).catch(() => null),
    spares_met: spares.filter((entry) => ["met", "at_margin"].includes(entry.reason.research?.state ?? "")).length,
    // Not measured is never met: a spare the commit did not check is counted apart.
    spares_unchecked: spares.filter((entry) => entry.reason.research === undefined).length,
    spares_of: WEEK_PLAN.spares,
    // A date of the span no row is committed to.
    uncovered: Array.from({ length: Math.max(0, span.days) }, (_, n) => new Date(Date.parse(span.from) + n * 86_400_000).toISOString().slice(0, 10)).filter((date) => !week.some((entry) => entry.plannedFor === date)).length,
  };
  // The record never holds the week's telling: a write that fails is only logged.
  await (a.again === true ? replaceOpsEvent : claimOpsEvent)("week_research", a.siteId, a.weekStart, JSON.stringify(read)).catch((error: unknown) => console.warn(JSON.stringify({ event: "week_research_unrecorded", siteId: a.siteId, error: String(error).slice(0, 200) })));
}
