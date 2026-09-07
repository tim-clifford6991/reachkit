// BUILD §4.5 — Overview's facts, for a real signed-in account.
//
// The other half of `provider.ts`: what `readOverview` assembles from when
// the account is a customer's rather than the reserved fixture account. It
// measures nothing, buys nothing and creates nothing — every value is a
// projection of rows another block already wrote, or the honest statement
// that no such row exists yet.
//
// **What is read, and whose rows it is:**
//
//   firstDueOn        §11's weekly clock — `nextDueOn`
//   pagesPublished    §9's live `publications`
//   supply            §7's own count — `supplyDepth`
//   waiting           §9's `in_review` and `needs_attention` drafts
//
//   points / aiPresence   §11's stored weekly scans — `readWeekScans`
//   changes               §4.7's change markers — `changeMarkers`
//
// **The weekly series is read, not stubbed** (issue #213). This file used
// to answer `points: []` and `aiPresence: []` unconditionally, on the
// grounds that "the reader that turns a `StoredReport` into a screen's
// series is #41's and #27's". Both landed long ago, so every real account
// was drawing the unmeasured arm of two tiles and an empty chart whatever
// had been measured for it — a stub that had outlived its reason and read
// as a measurement. The readers are §11's own (`readWeekScans` in
// `src/lib/scan/weekly/`), and this file projects what they return.
//
// **Three rules the projection keeps, each of which is REQ-004:**
//
//  1. **A week with no row is not a point with a zero.** It is
//     `unmeasured`, which is what makes the chart break at it rather than
//     draw a line through a week nobody measured.
//  2. **The window does not start before the customer did.** Weeks before
//     the first measured one are omitted, not carried as unmeasured
//     leading points: the AI window pads its own front (`aiWindow`), and
//     those are weeks that were never owed rather than weeks that were
//     missed.
//  3. **`unmeasured` is still the whole answer where nothing has been
//     measured.** A customer who signed in today has no measured week, and
//     the arm they see is the one the screen was designed to open on — now
//     because it is true of them, rather than because the reader was
//     missing.
//
// **The rival set stays unmeasured, and that is not this issue.** §6.6's
// per-rival sizing over weeks is #27's; the confirmed set is empty here and
// `resolveRivals` draws its cold-start arm from that, which is what it
// drew before. Filling `own` alone from the weekly report would flip the
// module to its ratio arm with no rows in it — a visual change with no
// mockup, and one this issue's boxes do not ask for.
//
// A fixture in any of these places would put another account's numbers on
// their screen; a fabricated zero would be worse still, because a zero is a
// claim (`measuredZero`) and this product does not make claims it has not
// measured.
import { OVERVIEW_TRAILING_WEEKS, SUPPLY_SHORT_BELOW } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
// Imported by file rather than through `@/lib/market/changes`: the barrel
// also re-exports the declared answers and the pending-change computation,
// and this screen needs the markers alone. The same reason
// `access-gate.ts` reaches its seam by file (ADR-050).
import { changeMarkers, type ChangeMarker } from "@/lib/market/changes/markers";
import { unmeasured, measured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import { nextDueOn, previousWeekStart, readWeekScans, weekStartFor } from "@/lib/scan/weekly";
import type { OverviewFacts } from "./model";
import type { WeeklyPoint } from "./growth";
import type { WaitingItem } from "./alerts";

export interface OverviewSite {
  siteId: string;
  timeZone: string;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** §9's live pages: delivered, not taken down. The same predicate the
 *  hosted edge's sitemap reads, so the count on this screen and the pages
 *  actually being served cannot disagree. */
async function pagesPublished(siteId: string, at: Date): Promise<Measured<number>> {
  const { data, error } = await client()
    .from<{ id: string }>("publications")
    .select("id")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (error !== null || data === null) {
    // A count we could not take is not a count of zero. `undeterminable`
    // renders the dash and its own line; a `0` would be a claim that this
    // customer has published nothing (REQ-004).
    return unmeasured<number>("undeterminable", at);
  }
  return measured(data.length, at);
}

/** §9's two states that wait on the customer. `needs_you` outranks
 *  `pending_veto` and `readAlerts` applies that order — this file supplies
 *  the items and chooses nothing. */
async function waitingItems(siteId: string): Promise<readonly WaitingItem[]> {
  const { data, error } = await client()
    .from<{ id: string; state: string; title: string; created_at: string }>("drafts")
    .select("id, state, title, created_at")
    .eq("site_id", siteId)
    .in("state", ["in_review", "needs_attention"])
    .order("created_at", { ascending: true });
  if (error !== null || data === null) return [];
  return data.map((row) => ({
    kind: row.state === "needs_attention" ? ("needs_you" as const) : ("pending_veto" as const),
    // The customer's own words for their page, never a sentence this
    // product composed.
    title: row.title,
    since: new Date(row.created_at),
    href: `/app/draft/${row.id}`,
  }));
}

/** The trailing window's Mondays, oldest first, in the site's own zone.
 *  `OVERVIEW_TRAILING_WEEKS` of them — the same window the chart draws and
 *  the AI tile counts over, so the screen's two readings can never mean
 *  different weeks. */
function windowWeeks(now: Date, timeZone: string): string[] {
  const weeks: string[] = [weekStartFor({ at: now, zone: timeZone })];
  for (let back = 1; back < OVERVIEW_TRAILING_WEEKS; back += 1) {
    weeks.unshift(previousWeekStart(weeks[0] as string));
  }
  return weeks;
}

/** A `week_start` as the instant a surface states it at. Midday UTC, so a
 *  Monday rendered in a zone either side of it is still that Monday. */
function mondayOf(weekStart: string): Date {
  return new Date(`${weekStart}T12:00:00.000Z`);
}

/** The customer's own ranked count for a week — §4.5's "searches you appear
 *  in", already `Measured` on the report and carried across as it is. A
 *  week whose pass did not reach it says so itself. */
function ownRankedOf(report: StoredReport | null, at: Date): Measured<number> {
  return report === null ? unmeasured<number>("not_attempted", at) : report.ownRanked;
}

/** Whether the customer was named in at least one tracked question's AI
 *  answer that week (DECISIONS 2026-09-03's one reading).
 *
 *  `null` is a week that was not measured, and `false` is a week that was:
 *  the two are different facts and the matrix draws them differently — a
 *  blank cell against an empty one — so a week whose pass never reached the
 *  AI answers must not read as a miss. */
function presentInAnswers(report: StoredReport | null): boolean | null {
  if (report === null || report.aiAnswers === null) return null;
  return report.aiAnswers.customerCitations > 0;
}

/**
 * The weekly series, its AI-answer presence and the dates it breaks at.
 *
 * One read for the window (`readWeekScans`) and one for the markers, run
 * together. The series starts at the **first measured week** rather than at
 * the window's edge: the weeks before it were never owed, and carrying them
 * as unmeasured points would draw eleven gaps for a customer measured once.
 */
async function weeklySeries(
  site: OverviewSite,
  now: Date
): Promise<{ points: WeeklyPoint[]; aiPresence: (boolean | null)[]; changes: readonly ChangeMarker[] }> {
  const weeks = windowWeeks(now, site.timeZone);
  const scans = await readWeekScans({ siteId: site.siteId, weekStarts: weeks });

  const first = weeks.findIndex((week) => scans.has(week));
  if (first === -1) return { points: [], aiPresence: [], changes: [] };

  const measuredWeeks = weeks.slice(first);
  const points = measuredWeeks.map((week): WeeklyPoint => {
    const at = mondayOf(week);
    return { weekStart: at, value: ownRankedOf(scans.get(week)?.report ?? null, at) };
  });
  const aiPresence = measuredWeeks.map((week) => presentInAnswers(scans.get(week)?.report ?? null));

  // The dates the series breaks at (REQ-071 c12/c13). Derived from the
  // scans themselves — this screen states no change of its own — and
  // bounded by the window it draws, so a change from before the first
  // point cannot break a chart that does not span it.
  const changes = await changeMarkers({
    siteId: site.siteId,
    from: points[0]?.weekStart ?? now,
    to: now,
  });

  return { points, aiPresence, changes };
}

/**
 * Everything §4.5 states about one real account.
 *
 * The reads are independent, so they run together rather than four round
 * trips deep.
 */
export async function readOverviewFacts(site: OverviewSite): Promise<OverviewFacts> {
  const now = new Date();
  const { supplyDepth } = await import("@/lib/opportunities");

  const [firstDueOn, published, depth, waiting, series] = await Promise.all([
    nextDueOn({ siteId: site.siteId, now }),
    pagesPublished(site.siteId, now),
    supplyDepth(site.siteId),
    waitingItems(site.siteId),
    weeklySeries(site, now),
  ]);

  return {
    timeZone: site.timeZone,
    // §11's stored weeks, projected (#213). Empty is still not a claim:
    // where nothing has been measured `readGrowth` answers its `none` arm
    // from `firstDueOn`, which is a real date.
    points: series.points,
    firstDueOn,
    aiPresence: series.aiPresence,
    changes: series.changes,
    pagesPublished: published,
    rivals: {
      own: unmeasured<number>("not_attempted", now),
      rivals: [],
    },
    today: now,
    supply: {
      exhausted: depth.unused === 0,
      short: depth.unused > 0 && depth.unused < SUPPLY_SHORT_BELOW,
      // The first-arrival shortfall is a statement about the pass the
      // customer arrived after, which only the arrival itself can know
      // (`supplyNotice`'s `arrivedAfter`). An ordinary read of this screen
      // is not that arrival.
      firstArrivalShortfall: false,
    },
    waiting,
  };
}
