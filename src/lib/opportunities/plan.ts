// SPEC §7 *The week is committed on Monday*: the week a pass commits from stored rows, and the page a date's run writes.
import { unstable_cache } from "next/cache";
import { CACHE_WINDOWS_D, PLAN_DEPTH, SUPPLY_SHORT_BELOW, WEEK_PLAN, WEEK_RESEARCH } from "@/lib/config/constants";
import { stoppedOnCeiling } from "@/lib/scan/market-floor";
import { choose } from "./choose";
import { assessFixPages } from "./fix-page";
import { firstOpenDay, loadRanking, writableDays } from "./rank/open";
import { assessReadiness } from "./readiness";
import { opportunityStore, readOpportunity, supplyTag, type OpportunityRow, type PlanEntry } from "./store";
import type { Opportunity } from "./types";
import type { ResearchRead } from "@/lib/generate/standard";

const DAY_MS = 86_400_000;

/** The week's one readiness check, after its verdicts and refreshes, then its ranking: a day is planned only from a
 *  ready row, and `best` is the `WEEK_RESEARCH.rowsMax` rows whose research the commit reads. */
async function ranked(siteId: string, a: { now: Date; from?: string; record?: boolean; keepLater?: boolean; keepDates?: boolean; days?: number }) {
  // On demand, the week starts at the date being written; on Monday, at the first date with no page.
  const store = opportunityStore(), from = a.from ?? new Date(firstOpenDay(await store.draftedPages(siteId, 1), a.now) * DAY_MS).toISOString().slice(0, 10);
  const committed = a.keepDates ? await store.plannedRows(siteId) : [], held = new Set(committed.map((r) => r.id));
  // A re-plan leaves the committed week's readiness as the pass read it: only rows outside it are checked again.
  const only = a.keepDates ? new Set((await store.openRankable(siteId)).flatMap((r) => (held.has(r.id) ? [] : [r.id]))) : undefined;
  await assessReadiness(siteId, { at: a.now, now: a.now, ...(only === undefined ? {} : { only }) });
  await assessFixPages(siteId, { report: null, now: a.now });
  // Before the first weekly pass, the dated days stop where that Monday's pass opens the next week: a Wednesday 5, a Monday 7.
  const days = a.days ?? (a.keepLater ? 1 : (await store.weeklyCommit(siteId)) === null ? (8 - new Date(`${from}T00:00:00Z`).getUTCDay()) % 7 || WEEK_PLAN.days : WEEK_PLAN.days);
  // A recommit fills its own date and the spares: the days after it stay as committed.
  const kept = a.keepLater ? (await store.plannedRows(siteId)).filter((r) => r.planned_for != null && r.planned_for > from) : [];
  const later = new Set(kept.map((r) => r.id)), top = Math.max(0, ...kept.map((r) => r.plan_place ?? 0));
  const load = await loadRanking(siteId, a.now, undefined, a.record === true), free = (r: OpportunityRow) => !later.has(r.id);
  const keep = a.keepDates ? new Map(committed.flatMap((r) => (r.planned_for != null && r.planned_for >= from ? [[r.id, r.planned_for] as const] : []))) : undefined;
  const verdicts = new Map(committed.flatMap((r) => (r.plan_reason?.research == null ? [] : [[r.id, { writeAs: r.plan_write_as ?? null, reason: r.plan_reason }] as const])));
  const input = { ...load, rows: load.rows.filter(free), fixRows: load.fixRows.filter(free), at: a.now, from, days, ...(keep === undefined ? {} : { keep }), ...(verdicts.size === 0 ? {} : { verdicts }) };
  const order = choose(input), best = new Set([...order.committed, ...order.rejected.filter((r) => r.reason === "after_the_week")].slice(0, WEEK_RESEARCH.rowsMax).map((r) => r.opportunityId));
  return { input, order, best: [...best].flatMap((id) => input.rows.filter((r) => r.id === id)), later, top, from, days };
}

/** The open rows the commit refuses as a live page's twin, by its own test, so supply never counts a place no week can use. */
export const liveTwinIds = async (siteId: string, now: Date): Promise<Set<string>> =>
  new Set(choose({ ...(await loadRanking(siteId, now)), at: now, from: now.toISOString().slice(0, 10) }).rejected.flatMap((r) => (r.reason === "live_twin" ? [r.opportunityId] : [])));

/** The rows the Monday commit checks the research of, best first. */
export const weekCandidates = async (siteId: string, now: Date): Promise<OpportunityRow[]> => (await ranked(siteId, { now })).best;

/** Commits and returns the site's week, from `from` where it is given; what is chosen is `choose`'s. `research` is the
 *  row checks the Monday job already made; a best row it lacks is read from the cache. */
export async function planWeek(siteId: string, a: { now?: Date; from?: string; record?: boolean; keepLater?: boolean; keepDates?: boolean; days?: number; research?: ReadonlyMap<string, ResearchRead | null> } = {}): Promise<readonly PlanEntry[] & { from: string; days: number; rejected: Record<string, { n: number; ids?: string[] }>; rested: { opportunityId: string; short: string[] }[] }> {
  const now = a.now ?? new Date(), store = opportunityStore();
  const { input, order, best, later, top, from, days } = await ranked(siteId, { ...a, now });
  // The ranking's best rows are then ordered by what research the cache holds for them.
  const unread = best.filter((r) => !a.research?.has(r.id) && !input.verdicts?.has(r.id)), held = store.researchHeld === undefined || unread.length === 0 ? new Map() : await store.researchHeld(siteId, unread, now);
  const choice = store.researchHeld === undefined && a.research === undefined && input.verdicts === undefined ? order : choose({ ...input, research: new Map([...held, ...(a.research ?? [])]) });
  // A short row no day or spare took rests until its SERP is read again.
  const rested = choice.rejected.flatMap((r) => (r.reason === "short" ? [{ opportunityId: r.opportunityId, short: r.short ?? [] }] : []));
  for (const r of rested) await store.rest(r.opportunityId, new Date(now.getTime() + CACHE_WINDOWS_D.serp * DAY_MS));
  // The day keeps place 0, which no later row holds; the spares follow the kept rows so no two rows share a place.
  const entries = choice.committed.map((e) => (e.plannedFor === null ? { ...e, place: top + e.place } : e)), rejected: Record<string, { n: number; ids?: string[] }> = {};
  for (const r of choice.rejected) { const tally = (rejected[r.reason] ??= r.reason === "after_the_week" ? { n: 0 } : { n: 0, ids: [] }); tally.n++; tally.ids?.push(r.opportunityId); }
  await store.commitPlan(siteId, entries, a.keepLater ? from : undefined);
  console.log(JSON.stringify({ event: "week_planned", siteId, from, days: Math.min(entries.length, days), spares: Math.max(0, entries.length - days), kept: later.size, rejected }));
  return Object.assign(entries, { from, days, rejected, rested });
}

/** A new site's first week, committed when setup's pass ends so Plan shows it before the first evening, filled by the
 *  `research` checks as Monday's is. Only where the site has no commit yet: a week the first draft committed stands. */
export async function planFirstWeek(siteId: string, now: Date = new Date(), research?: ReadonlyMap<string, ResearchRead | null>): Promise<readonly PlanEntry[]> {
  if ((await opportunityStore().plannedRows(siteId)).length > 0) return [];
  return planWeek(siteId, { now, ...(research === undefined ? {} : { research }) });
}

/** The page a date's run writes: its planned row where it still stands, else the next spare; nothing ranks here. A date
 *  no commit covers is committed from the date; one whose slot and spares are used up while ready rows wait commits its
 *  own date and spares, once. `null` where nothing left can be written; `updatesTried` once the update fallback had its turn. */
export async function pageForDay(siteId: string, date: string, now: Date = new Date(), updatesTried = false): Promise<Opportunity | null> {
  const store = opportunityStore();
  const held = await store.plannedRows(siteId);
  if (!held.some((row) => row.planned_for != null && row.planned_for >= date)) {
    await planWeek(siteId, { now, from: date });
  } else {
    // The 0¢ evening check, on the week's rows alone.
    const only = new Set(held.map((row) => row.id));
    await assessReadiness(siteId, { at: now, now, only });
    await assessFixPages(siteId, { report: null, now, only });
  }
  const open = (await store.plannedRows(siteId)).filter((row) => row.status === "open" && row.ready);
  const row = open.find((r) => r.planned_for === date) ?? open.find((r) => r.planned_for == null);
  if (row !== undefined) return planned(row);
  // A ready update dated later is the day's update fallback's to take first, so the recommit stays the last resort.
  if (!updatesTried && open.some((r) => r.family === "improve" && r.planned_for != null && r.planned_for > date)) return null;
  const waiting = (await store.countUnused(siteId)) - open.filter((r) => r.family !== "fix").length;
  if (waiting <= 0 || !(await store.claimRecommit(siteId, date))) return null;
  await planWeek(siteId, { now, from: date, keepLater: true });
  const slot = (await store.plannedRows(siteId)).find((r) => r.planned_for === date);
  return slot === undefined ? null : planned(slot);
}

/** The committed week as the digest, the calendar and the daily job read it: the open dated rows, by date, and the open
 *  spares, by place. `week` is the Monday the days are kept to; absent, the whole commit, which is the current week. */
export async function committedWeek(siteId: string, week?: string): Promise<{ days: readonly { date: string; opportunity: Opportunity }[]; spares: readonly Opportunity[] }> {
  const store = opportunityStore();
  const rows = (await store.plannedRows(siteId)).filter((row) => row.status === "open");
  const end = week === undefined ? null : new Date(Date.parse(`${week}T00:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  const inWeek = (date: string) => week === undefined || (date >= week && date < end!);
  return {
    days: rows.flatMap((row) => (row.planned_for == null || !inWeek(row.planned_for) ? [] : [{ date: row.planned_for, opportunity: planned(row) }])),
    spares: rows.filter((row) => row.planned_for == null).map((row) => planned(row)),
  };
}

/** The first date the committed week holds, written or not: the day the pass chose it; `null` before the first commit. */
export async function weekChosenOn(siteId: string): Promise<string | null> {
  const dates = (await opportunityStore().plannedRows(siteId)).flatMap((row) => (row.planned_for == null ? [] : [row.planned_for]));
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b));
}

/** The row as the day writes it: as the type the commit stored where it stored one (issue 1455). */
function planned(row: OpportunityRow): Opportunity {
  return row.plan_write_as == null ? readOpportunity(row) : { ...readOpportunity(row), writeAs: row.plan_write_as };
}

// Supply, as Overview and Plan state it; never a target (SPEC §14 guardrail 1). Derived from the rows and stored
// nowhere; a screen's copy is held at most 5 minutes and cleared by any opportunity write.

export interface Depth {
  /** Days of pages: writable days up to `PLAN_DEPTH` (decisions 1549, 1559). */
  unused: number;
  /** Set only while `unused` is 0, so a stale date is never read as live. */
  exhaustedSince: Date | null;
}

/** Held per site: nav prefetch renders several screens at once, and each would rank every open row. */
export async function supplyDepth(siteId: string): Promise<Depth> {
  // Outside Next (a suite, a script) there is no cache to hold it.
  if (process.env.NEXT_RUNTIME === undefined) return readDepth(siteId);
  const depth = await unstable_cache(readDepth, ["supply-depth"], { tags: [supplyTag(siteId)], revalidate: 300 })(siteId);
  // The cache hands back JSON, so the date is a string again.
  return { ...depth, exhaustedSince: depth.exhaustedSince === null ? null : new Date(depth.exhaustedSince) };
}

async function readDepth(siteId: string): Promise<Depth> {
  const store = opportunityStore();
  if ((await store.countUnused(siteId)) > 0) return { unused: await writableDays(siteId), exhaustedSince: null };
  // Since the last non-Fix status change, else the scan that last looked and found nothing, else no date.
  const lastChange = await store.lastStatusChangeAt(siteId);
  if (lastChange !== null) return { unused: 0, exhaustedSince: lastChange };
  return { unused: 0, exhaustedSince: await store.latestCompletedScanAt(siteId) };
}

/** Whether a site with no supply ever had a market to use up (#765): its report asked questions and it held a non-Fix row. */
export async function supplyMeasured(siteId: string): Promise<boolean> {
  const store = opportunityStore();
  const [report, lastChange] = await Promise.all([store.currentReport(siteId), store.lastStatusChangeAt(siteId)]);
  const questions = report?.questions;
  const asked = questions !== undefined && questions.kind !== "unmeasured" && questions.value.length > 0;
  return asked && lastChange !== null;
}

/** What a site's zero supply is (issue 855): `measured` — a market used up; `unmeasured` — never measured (#765);
 *  `measuring` — a ceiling stopped the pass, so it is being measured again. */
export type SupplyState = "measured" | "unmeasured" | "measuring";

export async function supplyState(siteId: string): Promise<SupplyState> {
  const store = opportunityStore();
  const report = await store.currentReport(siteId);
  if (report !== null && stoppedOnCeiling(report.stoppedReason)) return "measuring";
  return (await supplyMeasured(siteId)) ? "measured" : "unmeasured";
}

/** At most one statement of supply: `exhausted` > `short` > `arrival_shortfall` (ADR-061); the lines are the copy registry's. */
export type SupplyNotice =
  | { kind: "exhausted"; days: 0; since: Date | null }
  /** 1..SUPPLY_SHORT_BELOW-1 */
  | { kind: "short"; days: number }
  /** The customer's first arrival after a pass that fell short. */
  | { kind: "arrival_shortfall"; days: number };

export async function supplyNotice(a: {
  siteId: string;
  /** The scan the customer is arriving after, where this read is that first arrival. */
  firstArrivalAfter?: string;
  /** The depth the caller already read, which is not read again. */
  depth?: Depth;
}): Promise<SupplyNotice | null> {
  const { unused, exhaustedSince } = a.depth ?? (await supplyDepth(a.siteId));
  if (unused === 0) return { kind: "exhausted", days: 0, since: exhaustedSince };
  if (unused < SUPPLY_SHORT_BELOW) return { kind: "short", days: unused };
  // Said once, on arrival after a pass that did not reach a week and its spares.
  if (a.firstArrivalAfter !== undefined && unused < PLAN_DEPTH) return { kind: "arrival_shortfall", days: unused };
  return null;
}
