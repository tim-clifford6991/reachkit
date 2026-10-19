// SPEC §7 (owner, 2026-10-19, issue 1559) — the week a weekly pass commits.
//
// "On our weekly refresh, we pull in all new tracking information we require
// including keywords, ai searches and rivals. This context together with the
// users business context is used to find the next 7 content generations."
//
// The weekly pass ends here (`planWeek`): one readiness check over the open
// rows, one ranking (`rankOpen`, the one list), and its first
// `WEEK_PLAN.days` rows committed one a day from the first date with no
// page, with `WEEK_PLAN.spares` after them. The daily job writes the row
// planned for its date (`pageForDay`) after a 0¢ check that the week's rows
// still stand (a rest, the destination, a page that now covers the topic);
// where that page cannot be written it takes the spare that best fits the
// day (`takeSpare`). Nothing ranks the open pool again until the next
// commit.
//
// A date no commit covers — a new site, or one before its first Monday —
// is committed on demand by that evening's run, once: the commit then
// covers the dates after it.
import { PLAN_DEPTH, WEEK_PLAN } from "@/lib/config/constants";
import { assessFixPages } from "./fix-page";
import { mixOf, rankOpen } from "./rank/open";
import { assessReadiness } from "./readiness";
import { opportunityStore, readOpportunity, type OpportunityRow, type PlanEntry } from "./store";
import type { Opportunity } from "./types";

const DAY_MS = 86_400_000;

const dayOf = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const dateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/**
 * Commits the site's week: the next `WEEK_PLAN.days` pages, one a day from
 * `from` where it is given, else from the first date with no page, then
 * `WEEK_PLAN.spares` spares. Returns what it committed. Database reads and
 * writes only.
 */
export async function planWeek(siteId: string, a: { now?: Date; from?: string } = {}): Promise<readonly PlanEntry[]> {
  const now = a.now ?? new Date();
  const store = opportunityStore();
  // SPEC §6: the week's one readiness check, after the week's verdicts and
  // refreshes are written, so a day is planned only from a ready row.
  await assessReadiness(siteId, { at: now, now });
  await assessFixPages(siteId, { report: null, now });
  const ranked = await rankOpen(siteId, now);
  // On demand, the week starts at the date being written; on Monday, at the
  // first date with no page.
  const first = a.from !== undefined ? dayOf(a.from) : mixOf(await store.draftedPages(siteId, 1), now).from;
  const entries: PlanEntry[] = ranked.slice(0, PLAN_DEPTH).map((entry, place) => ({
    opportunityId: entry.opportunityId,
    place,
    plannedFor: place < WEEK_PLAN.days ? dateOf(first + place) : null,
    writeAs: entry.writeAs ?? null,
  }));
  await store.commitPlan?.(siteId, entries);
  console.log(
    JSON.stringify({
      event: "week_planned",
      siteId,
      from: dateOf(first),
      days: Math.min(entries.length, WEEK_PLAN.days),
      spares: Math.max(0, entries.length - WEEK_PLAN.days),
    })
  );
  return entries;
}

/**
 * The page a date's run writes: the row the week planned for it, where it
 * still stands, else the best spare. A date no commit covers is committed
 * here first, once. `null` where the week holds nothing left to write.
 */
export async function pageForDay(siteId: string, date: string, now: Date = new Date()): Promise<Opportunity | null> {
  const store = opportunityStore();
  const held = store.plannedRows === undefined ? null : await store.plannedRows(siteId);
  const covered = held !== null && held.some((row) => row.planned_for != null && row.planned_for >= date);
  if (!covered) {
    const entries = await planWeek(siteId, { now, from: date });
    // A store that holds no week: the commit is read as it was made.
    if (held === null) {
      const slot = entries.find((entry) => entry.plannedFor === date) ?? entries[0];
      return slot === undefined ? null : load(await store.byId(slot.opportunityId), slot.writeAs);
    }
  } else {
    // The 0¢ evening check, on the week's rows alone.
    const only = new Set(held.map((row) => row.id));
    await assessReadiness(siteId, { at: now, now, only });
    await assessFixPages(siteId, { report: null, now, only });
  }
  const rows = await store.plannedRows!(siteId);
  const slot = rows.find((row) => row.planned_for === date);
  if (slot !== undefined && slot.status === "open" && slot.ready) {
    return load(slot, slot.plan_write_as === "qa" ? "qa" : null);
  }
  return takeSpare(siteId, now);
}

/**
 * The week's spare that best fits the day — the one list's order over the
 * spares still open and ready, so the day's mix and D52's cap still hold.
 * Where the store holds no week, the head of the one list.
 */
export async function takeSpare(siteId: string, now: Date = new Date()): Promise<Opportunity | null> {
  const store = opportunityStore();
  const rows = store.plannedRows === undefined ? null : await store.plannedRows(siteId);
  const spares = rows === null ? undefined : new Set(rows.filter((row) => row.planned_for == null && row.status === "open").map((row) => row.id));
  if (spares?.size === 0) return null;
  const [head] = await rankOpen(siteId, now, spares);
  return head === undefined ? null : load(await store.byId(head.opportunityId), head.writeAs ?? null);
}

/** The committed week as the digest and the calendar state it: the open
 *  rows planned for a date, by date, and the open spares, by place. */
export async function committedWeek(siteId: string): Promise<{
  days: readonly { date: string; opportunity: Opportunity }[];
  spares: readonly Opportunity[];
}> {
  const store = opportunityStore();
  const rows = (store.plannedRows === undefined ? [] : await store.plannedRows(siteId)).filter((row) => row.status === "open");
  return {
    days: rows.flatMap((row) => (row.planned_for == null ? [] : [{ date: row.planned_for, opportunity: readOpportunity(row) }])),
    spares: rows.filter((row) => row.planned_for == null).map(readOpportunity),
  };
}

function load(row: OpportunityRow | null, writeAs: "qa" | null): Opportunity | null {
  if (row === null) return null;
  // Issue 1455: a comparison over D52's cap is written as a Q&A.
  return writeAs === null ? readOpportunity(row) : { ...readOpportunity(row), writeAs };
}
