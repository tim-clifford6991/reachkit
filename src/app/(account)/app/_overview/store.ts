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
// **The rival rows are read too** (issue #223). §6.6's sizing rides the
// same stored weekly report the series comes from — `rivalSizes`, one entry
// per tracked rival — so the rows are a projection of it and of the
// customer's own current set, and nothing on this screen sizes anything.
// Four rules, each of them REQ-096:
//
//  · **The rows are the rivals the customer tracks now, in their order.** A
//    rival they removed since Monday's pass is not drawn from a stored
//    entry that outlived it, and one they added since has a row with
//    nothing measured in it rather than no row at all (c5, c7).
//  · **A week that did not size a rival contributes no point and no
//    number.** `unmeasured` on the row and a shorter series — never a zero,
//    which would say the rival ranks for nothing.
//  · **The series carries the units of the arm the module will take** —
//    the ratio where the customer's own count has passed the unlock, the
//    rival's own count where it has not — because that is what
//    `RivalFact.series` is declared to be.
//  · **A rival banded `far` carries the offer, on either arm.** The band is
//    on the stored entry and the condition is `swapOffer`'s; this file
//    hands the entry over whole and decides nothing about it.
//
// A fixture in any of these places would put another account's numbers on
// their screen; a fabricated zero would be worse still, because a zero is a
// claim (`measuredZero`) and this product does not make claims it has not
// measured.
import { OVERVIEW_TRAILING_WEEKS, RATIO_UNLOCK, SUPPLY_SHORT_BELOW } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
// Imported by file rather than through `@/lib/market/changes`: the barrel
// also re-exports the declared answers and the pending-change computation,
// and this screen needs the markers alone. The same reason
// `access-gate.ts` reaches its seam by file (ADR-050).
import { changeMarkers, type ChangeMarker } from "@/lib/market/changes/markers";
import { unmeasured, measured, type Measured } from "@/lib/measure/measured";
import type { RivalSize } from "@/lib/market/rivals/rival-size";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { StoredReport } from "@/lib/scan/report";
import {
  nextDueOn,
  previousWeekStart,
  readWeekScans,
  weekStartFor,
  type WeekScan,
} from "@/lib/scan/weekly";
import type { OverviewFacts } from "./model";
import type { WeeklyPoint } from "./growth";
import type { RivalFact, RivalFacts } from "./rivals";
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
interface WeeklyFacts {
  points: WeeklyPoint[];
  aiPresence: (boolean | null)[];
  changes: readonly ChangeMarker[];
  rivals: RivalFacts;
}

async function weeklySeries(site: OverviewSite, now: Date): Promise<WeeklyFacts> {
  const weeks = windowWeeks(now, site.timeZone);
  const scans = await readWeekScans({ siteId: site.siteId, weekStarts: weeks });

  // The two weeks every current figure on this screen is read from. The
  // *latest measured* week, not the current one: a customer reading on a
  // Sunday is shown last Monday's numbers rather than a blank because this
  // week's pass has not run. `previous` is the measured week before that —
  // what a delta and a `was 276×` are taken against — and skipping an
  // unmeasured week between them is right, because the comparison is
  // between two measurements and not between two calendar weeks.
  const measured = weeks.filter((week) => scans.get(week)?.report != null);
  const latest = scans.get(measured.at(-1) ?? "")?.report ?? null;
  const previousWeek = scans.get(measured.at(-2) ?? "")?.report ?? null;
  const rivals = await rivalFacts({
    siteId: site.siteId,
    weeks,
    scans,
    latest,
    previous: previousWeek,
    now,
  });

  const first = weeks.findIndex((week) => scans.has(week));
  if (first === -1) return { points: [], aiPresence: [], changes: [], rivals };

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

  return { points, aiPresence, changes, rivals };
}

/** §6.6's sizing for one rival in one week, or nothing. The entries are
 *  keyed by domain and the array is short (at most five tracked rivals), so
 *  the lookup is a find rather than a map built per week. */
function sizingFor(report: StoredReport | null, domain: string): RivalSize | undefined {
  if (report === null || report.rivalSizes.kind === "unmeasured") return undefined;
  return report.rivalSizes.value.find((size) => size.domain === domain);
}

/** The rival's own ranked count for a week, or nothing where that week did
 *  not size it. `unsized` is **not** a zero: it is a week with no number in
 *  it, and the caller leaves the point out rather than plotting a floor the
 *  rival never sat on. */
function rivalCountOf(size: RivalSize | undefined): number | undefined {
  return size !== undefined && size.state === "sized" ? size.rankedCount : undefined;
}

/** The customer's own count for a week, where the pass measured one. */
function ownCountOf(report: StoredReport | null): number | undefined {
  if (report === null || report.ownRanked.kind === "unmeasured") return undefined;
  return report.ownRanked.value;
}

/**
 * How the gap to one rival has moved, in the units the module will draw it
 * in.
 *
 * `RivalFact.series` is declared as "the ratio over time on the warm arm,
 * the rival's own count over time on the cold one", and which arm is taken
 * is decided by the **latest** own count — so the whole series is in one
 * unit and a row cannot plot a ratio against a count.
 *
 * A week that measured one side and not the other contributes nothing. It
 * is left **out** rather than entered as `null`: a `null` in this series
 * means a break the row has to account for beside the plot (a domain
 * change), and using it for "we did not measure that week" would state a
 * discontinuity that did not happen.
 */
function seriesFor(a: {
  domain: string;
  weeks: readonly string[];
  scans: ReadonlyMap<string, WeekScan>;
  warm: boolean;
}): number[] {
  const points: number[] = [];
  for (const week of a.weeks) {
    const report = a.scans.get(week)?.report ?? null;
    const rival = rivalCountOf(sizingFor(report, a.domain));
    if (rival === undefined) continue;
    if (!a.warm) {
      points.push(rival);
      continue;
    }
    const own = ownCountOf(report);
    if (own === undefined || own <= 0) continue;
    points.push(Math.round(rival / own));
  }
  return points;
}

/**
 * The rival rows, from the customer's own set and the weeks that sized it.
 *
 * The rows are the **tracked set**, in the customer's own order, and every
 * one of them gets a row whatever the week found: REQ-096 c7 keeps a rival
 * in every comparison until the customer takes it out themselves, and c5
 * says an unsized rival states that for itself rather than being left out
 * or shown a zero.
 */
async function rivalFacts(a: {
  siteId: string;
  weeks: readonly string[];
  scans: ReadonlyMap<string, WeekScan>;
  latest: StoredReport | null;
  previous: StoredReport | null;
  now: Date;
}): Promise<RivalFacts> {
  const own = a.latest === null ? unmeasured<number>("not_attempted", a.now) : a.latest.ownRanked;
  const previousOwn = a.previous === null ? undefined : a.previous.ownRanked;
  const tracked = await trackedRivals(a.siteId);
  if (tracked === null || tracked.length === 0) {
    return { own, ...(previousOwn === undefined ? {} : { previousOwn }), rivals: [] };
  }

  const ownCount = own.kind === "unmeasured" ? 0 : own.value;
  const warm = ownCount >= RATIO_UNLOCK;

  const rivals: RivalFact[] = tracked.map((domain) => {
    const size = sizingFor(a.latest, domain);
    const ranked = rivalCountOf(size);
    const previousRanked = rivalCountOf(sizingFor(a.previous, domain));
    return {
      domain,
      // Every row here is one the customer chose: the set is read from
      // their own answer, so the flag `resolveRivals` filters on is true by
      // construction rather than by a judgement this file makes.
      confirmed: true,
      ranked:
        ranked === undefined || size === undefined || size.state !== "sized"
          ? unmeasured<number>("not_attempted", a.now)
          : measured(ranked, size.at),
      ...(previousRanked === undefined ? {} : { previousRanked: measured(previousRanked, a.now) }),
      series: seriesFor({ domain, weeks: a.weeks, scans: a.scans, warm }),
      ...(size === undefined ? {} : { size }),
    };
  });

  return { own, ...(previousOwn === undefined ? {} : { previousOwn }), rivals };
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
    rivals: series.rivals,
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
