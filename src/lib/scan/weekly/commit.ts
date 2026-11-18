// SPEC §7 *The week is committed on Monday*: the Monday job's judge and commit steps, either side of the research steps
// (`src/lib/generate/research-queue.ts`), and the record of what the week was short of.
import { WEEK_PLAN } from "@/lib/config/constants";
import type { Checks, WeekRow } from "@/lib/generate/research-queue";
import { judgeWeek, planRefreshes, planWeek } from "@/lib/opportunities";
import { weekCandidates } from "@/lib/opportunities/plan";
import { claimOpsEvent } from "@/lib/ops/events";

/** The week's verdicts and its refreshes, then the `WEEK_RESEARCH.rowsMax` best-ranked writable rows the commit checks. */
export async function judgeWeekRows(a: { siteId: string; weekStart: string; now: Date }): Promise<WeekRow[]> {
  await judgeWeek({ siteId: a.siteId, week: a.weekStart });
  // The live pages due a refresh are planned before readiness is recorded on them.
  await planRefreshes({ siteId: a.siteId, at: a.now });
  return (await weekCandidates(a.siteId, a.now)).map((row) => ({ id: row.id, target_query: row.target_query, topUp: (row.evidence as { topUp?: true } | null)?.topUp === true }));
}

/** Commits the week from the checks, then records once per site and week what it was short of (SPEC §7). */
export async function commitWeek(a: { siteId: string; weekStart: string; now: Date; rows: readonly WeekRow[]; checks: Checks }): Promise<void> {
  const week = await planWeek(a.siteId, { now: a.now, record: true, research: new Map(a.checks) });
  const marks = [...week.flatMap((entry) => entry.reason.research ?? []), ...week.rested.map((rested) => ({ state: "short" as const, short: rested.short }))];
  const count = (state: string) => marks.filter((mark) => mark.state === state).length;
  const short: Record<string, number> = {};
  for (const part of marks.flatMap((mark) => (mark.state === "short" ? (mark.short ?? []) : []))) short[part] = (short[part] ?? 0) + 1;
  const tried = new Set(a.rows.filter((row) => row.topUp === true).map((row) => row.id));
  const spares = week.filter((entry) => entry.plannedFor === null);
  const read = {
    checked: a.checks.length,
    met: count("met"),
    at_margin: count("at_margin"),
    queued: count("queued"),
    short: { rows: count("short"), ...short },
    rested: week.rested.map((rested) => ({ id: rested.opportunityId, short: rested.short })),
    top_up: { tried: tried.size, kept: week.filter((entry) => tried.has(entry.opportunityId)).length },
    spares_met: spares.filter((entry) => ["met", "at_margin"].includes(entry.reason.research?.state ?? "")).length,
    // Not measured is never met: a spare the commit did not check is counted apart.
    spares_unchecked: spares.filter((entry) => entry.reason.research === undefined).length,
    spares_of: WEEK_PLAN.spares,
    uncovered: Math.max(0, WEEK_PLAN.days - week.length + spares.length),
  };
  // The record never holds the week's telling: a write that fails is only logged.
  await claimOpsEvent("week_research", a.siteId, a.weekStart, JSON.stringify(read)).catch((error: unknown) => console.warn(JSON.stringify({ event: "week_research_unrecorded", siteId: a.siteId, error: String(error).slice(0, 200) })));
}
