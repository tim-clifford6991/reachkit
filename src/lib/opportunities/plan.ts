// SPEC §7 (owner, 2026-10-19, issue 1559) — the week a weekly pass commits.
//
// "On our weekly refresh, we pull in all new tracking information we require
// including keywords, ai searches and rivals. This context together with the
// users business context is used to find the next 7 content generations."
//
// The weekly pass ends here (`planWeek`): one readiness check over the open
// rows, one choice (`choose`, over the one list), and its first
// `WEEK_PLAN.days` rows committed one a day from the first date with no
// page, with `WEEK_PLAN.spares` after them. The daily job writes the row
// planned for its date (`pageForDay`) after a 0¢ check that the week's rows
// still stand (a rest, the destination, a page that now covers the topic);
// where that page cannot be written it takes the next spare in committed
// order (`takeSpare`). Nothing ranks the open pool again until the next
// commit.
//
// A new site's first week is committed when setup's pass ends
// (`planFirstWeek`). A date no commit covers after that is committed on
// demand by that evening's run, once: the commit then covers the dates
// after it.
import { PLAN_DEPTH, SUPPLY_SHORT_BELOW, WEEK_PLAN } from "@/lib/config/constants";
import { stoppedOnCeiling } from "@/lib/scan/market-floor";
import { choose } from "./choose";
import { assessFixPages } from "./fix-page";
import { isPausedType } from "./paused";
import { loadRanking, mixOf, writableDays } from "./rank/open";
import { assessReadiness } from "./readiness";
import { opportunityStore, readOpportunity, type OpportunityRow, type PlanEntry } from "./store";
import type { Opportunity } from "./types";

const DAY_MS = 86_400_000;

/**
 * Commits the site's week: the next `WEEK_PLAN.days` pages, one a day from
 * `from` where it is given, else from the first date with no page, then
 * `WEEK_PLAN.spares` spares. Returns what it committed. Database reads and
 * writes only; what is chosen is `choose`'s.
 */
export async function planWeek(siteId: string, a: { now?: Date; from?: string } = {}): Promise<readonly PlanEntry[]> {
  const now = a.now ?? new Date();
  const store = opportunityStore();
  // SPEC §6: the week's one readiness check, after the week's verdicts and
  // refreshes are written, so a day is planned only from a ready row.
  await assessReadiness(siteId, { at: now, now });
  await assessFixPages(siteId, { report: null, now });
  // On demand, the week starts at the date being written; on Monday, at the
  // first date with no page.
  const from =
    a.from ?? new Date(mixOf(await store.draftedPages(siteId, 1), now).from * DAY_MS).toISOString().slice(0, 10);
  const entries: PlanEntry[] = choose({ ...(await loadRanking(siteId, now)), at: now, from }).committed;
  await store.commitPlan(siteId, entries);
  console.log(
    JSON.stringify({
      event: "week_planned",
      siteId,
      from,
      days: Math.min(entries.length, WEEK_PLAN.days),
      spares: Math.max(0, entries.length - WEEK_PLAN.days),
    })
  );
  return entries;
}

/**
 * A new site's first week, committed when setup's pass ends so Plan shows
 * it before the first evening. Only where the site has no commit yet: a
 * week the first draft already committed is never replaced.
 */
export async function planFirstWeek(siteId: string, now: Date = new Date()): Promise<readonly PlanEntry[]> {
  if ((await opportunityStore().plannedRows(siteId)).length > 0) return [];
  return planWeek(siteId, { now });
}

/**
 * The page a date's run writes: the row the week planned for it, where it
 * still stands, else the next spare. A date no commit covers is committed
 * here first, once. `null` where the week holds nothing left to write.
 */
export async function pageForDay(siteId: string, date: string, now: Date = new Date()): Promise<Opportunity | null> {
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
  const rows = await store.plannedRows(siteId);
  const slot = rows.find((row) => row.planned_for === date);
  if (slot !== undefined && slot.status === "open" && slot.ready) return planned(slot);
  return takeSpare(siteId);
}

/**
 * The week's next spare: the first in committed order that is still open,
 * ready and of a type the mix writes. Nothing ranks here (issue 1559).
 */
async function takeSpare(siteId: string): Promise<Opportunity | null> {
  const { spares } = await committedWeek(siteId);
  return spares.find((spare) => spare.ready && !isPausedType(spare)) ?? null;
}

/** The committed week as the digest, the calendar and the daily job read
 *  it: the open rows planned for a date, by date, and the open spares, by
 *  place. `week` is the Monday of the site's week the days are kept to;
 *  absent, it is the whole commit, which is the current week. */
export async function committedWeek(
  siteId: string,
  week?: string
): Promise<{
  days: readonly { date: string; opportunity: Opportunity }[];
  spares: readonly Opportunity[];
}> {
  const store = opportunityStore();
  const rows = (await store.plannedRows(siteId)).filter((row) => row.status === "open");
  const end = week === undefined ? null : new Date(Date.parse(`${week}T00:00:00Z`) + 7 * DAY_MS).toISOString().slice(0, 10);
  const inWeek = (date: string) => week === undefined || (date >= week && date < end!);
  return {
    days: rows.flatMap((row) =>
      row.planned_for == null || !inWeek(row.planned_for) ? [] : [{ date: row.planned_for, opportunity: planned(row) }]
    ),
    spares: rows.filter((row) => row.planned_for == null).map((row) => planned(row)),
  };
}

/** The first date the committed week holds, written or not: the day the
 *  pass chose it. `null` before the site's first commit. */
export async function weekChosenOn(siteId: string): Promise<string | null> {
  const dates = (await opportunityStore().plannedRows(siteId)).flatMap((row) => (row.planned_for == null ? [] : [row.planned_for]));
  return dates.length === 0 ? null : dates.reduce((a, b) => (a < b ? a : b));
}

/** The row as the day writes it: a comparison over D52's cap the commit
 *  marked is written as a Q&A (issue 1455). */
function planned(row: OpportunityRow): Opportunity {
  return row.plan_write_as === "qa" ? { ...readOpportunity(row), writeAs: "qa" } : readOpportunity(row);
}

// Supply, as Overview and Plan state it. Volume follows supply and is never
// a target (SPEC §14 guardrail 1): the count is derived on every read and
// stored nowhere, so it cannot drift from the rows it counts.

export interface Depth {
  /** Days of pages: writable days up to `PLAN_DEPTH` (decisions 1549, 1559). */
  unused: number;
  /** Set only while `unused` is 0, so a stale date is never read as live. */
  exhaustedSince: Date | null;
}

export async function supplyDepth(siteId: string, at: Date = new Date()): Promise<Depth> {
  const store = opportunityStore();
  if ((await store.countUnused(siteId)) > 0) return { unused: await writableDays(siteId, at), exhaustedSince: null };
  // Since the last non-Fix status change; with none, since the scan that last
  // looked and found nothing; with neither, no date rather than an invented one.
  const lastChange = await store.lastStatusChangeAt(siteId);
  if (lastChange !== null) return { unused: 0, exhaustedSince: lastChange };
  return { unused: 0, exhaustedSince: await store.latestCompletedScanAt(siteId) };
}

/** Whether a site with no supply ever had a market to use up (#765): its
 *  current report asked questions and it has held a non-Fix row. */
export async function supplyMeasured(siteId: string): Promise<boolean> {
  const store = opportunityStore();
  const [report, lastChange] = await Promise.all([store.currentReport(siteId), store.lastStatusChangeAt(siteId)]);
  const questions = report?.questions;
  const asked = questions !== undefined && questions.kind !== "unmeasured" && questions.value.length > 0;
  return asked && lastChange !== null;
}

/** What a site's zero supply is (issue 855): `measured` — a market used up;
 *  `unmeasured` — never measured (#765); `measuring` — a ceiling stopped the
 *  pass, so it is being measured again; `outsized` — every target is too big
 *  for the site today (issue 881). */
export type SupplyState = "measured" | "unmeasured" | "measuring" | "outsized";

export async function supplyState(siteId: string): Promise<SupplyState> {
  const store = opportunityStore();
  const report = await store.currentReport(siteId);
  if (report !== null && stoppedOnCeiling(report.stoppedReason)) return "measuring";
  // The more specific claim first; a count that cannot be read claims neither.
  if (await Promise.resolve().then(() => store.countOutsized(siteId)).catch(() => 0)) return "outsized";
  return (await supplyMeasured(siteId)) ? "measured" : "unmeasured";
}

/** At most one statement of supply, never an array: `exhausted` > `short` >
 *  `arrival_shortfall` (ADR-061). The lines are the copy registry's. */
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
}): Promise<SupplyNotice | null> {
  const { unused, exhaustedSince } = await supplyDepth(a.siteId);
  if (unused === 0) return { kind: "exhausted", days: 0, since: exhaustedSince };
  if (unused < SUPPLY_SHORT_BELOW) return { kind: "short", days: unused };
  // Said once, on arrival after a pass that did not reach a week and its spares.
  if (a.firstArrivalAfter !== undefined && unused < PLAN_DEPTH) return { kind: "arrival_shortfall", days: unused };
  return null;
}
