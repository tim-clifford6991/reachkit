// SPEC §4 (2026-09-20, #908) — the Rivals tab's facts, for a real account.
//
// The other half of `rivals-provider.ts`. It measures nothing, buys nothing
// and creates nothing: "read from the stored weekly report" is that date's
// own rule for this tab, and every value below is a projection of rows the
// pass already wrote.
//
// **What is read, and whose rows it is:**
//
//   who you track   `sites.competitors`, through `trackedRivals` — the
//                   confirmed set, in the customer's own order
//   first page      the stored report's `serps[]` — the twelve top tens
//                   the pass bought, one per question. Only counts have
//                   ever been rendered from them; this is the first screen
//                   to read the rows
//   named           `aiAnswers.rows[].engines[].cell.citedDomains`, read
//                   per domain through the same `markOf` the AI answers tab
//                   draws its marks with (#918)
//   what they win   `market.value.pool[]` — every search the site's own and
//                   its rivals' ranked rows carry — minus the searches the
//                   site itself ranks for
//   what we do      `opportunities`, joined on the target search
//
// **Two reads, and neither of them per row.** The report comes back whole
// and is projected in memory; a read per search would be one query per row
// on a table that draws a hundred and forty.
//
// **One implementation of "does this host belong to that domain", and it is
// the score's.** `classifyReferences` (`@/lib/measure/drivers.ts`) is what
// `aiPresenceOf` splits its two rates with and what #918's marks are
// derived from; reading its `cited` arm is how a SERP host and a cited
// domain are matched to a rival here. A second normaliser would be a second
// answer to "is this them".
import { dbAdmin } from "@/lib/db";
import { classifyReferences } from "@/lib/measure/drivers";
import { measured, type Measured } from "@/lib/measure/measured";
import type { AnswerCell, StoredReport } from "@/lib/scan/report";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { previousWeekStart, readWeekScans, weekStartFor } from "@/lib/scan/weekly";
import { OVERVIEW_TRAILING_WEEKS, RIVAL_PRESENCE } from "@/lib/config/constants";
import { isPlatformDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import { ANSWER_ENGINES, reachesYou } from "./answers-model";
import { markOf } from "./answers-store";
import {
  counted,
  notTaken,
  type RivalPoolFacts,
  type RivalSearchStatus,
  type RivalsFacts,
} from "./rivals-model";

export interface RivalsSite {
  siteId: string;
  timeZone: string;
  domain: string;
}

/** Whether any of these hosts is that domain, or a subdomain of it — the
 *  score's own test, read through its one exported arm. Exported so the two
 *  rules it decides (a first-page place, a named domain) can be held by a
 *  test without a database. */
export function isTheirs(domain: string, hosts: readonly string[]): boolean {
  return classifyReferences(hosts, domain).cited;
}

/** Google's first page. Ten results to a page is what it means to the
 *  customer, and it is the same ten the Search tab's own tile counts to. */
const FIRST_PAGE = 10;

export async function readRivalFacts(site: RivalsSite, at: Date): Promise<RivalsFacts> {
  const { opportunityStore } = await import("@/lib/opportunities/store");
  const store = opportunityStore();

  const [rivals, report, statuses] = await Promise.all([
    // A site whose row could not be read tracks nobody we can name; the
    // cards then draw the customer alone rather than refusing the screen.
    trackedRivals(site.siteId).catch(() => null),
    store.currentReport(site.siteId).catch(() => null),
    readStatuses(site.siteId).catch(() => new Map<string, RivalSearchStatus>()),
  ]);

  const tracked = rivals ?? [];
  const domains = [...tracked, site.domain];

  // ── Who is on the first page, over the twelve the pass could read.
  const serps = report?.serps ?? [];
  const firstPage = new Map<string, number>();
  let firstPageOf = 0;
  for (const serp of serps) {
    if (serp.kind === "unmeasured") continue;
    firstPageOf += 1;
    for (const domain of domains) {
      if (onFirstPage(serp.value, domain)) firstPage.set(domain, (firstPage.get(domain) ?? 0) + 1);
    }
  }

  // ── Who the answer engines name, over the answers that were asked. The
  // same reading the AI answers tab draws cell by cell (#918): a domain is
  // named when the answer links to it or carries its brand token elsewhere,
  // and it is `markOf` that decides which — one implementation, so "See
  // every answer" cannot lead to a screen that disagrees with this count.
  const named = new Map<string, number>();
  let namedOf = 0;
  for (const row of report?.aiAnswers?.rows ?? []) {
    const columns = row.engines.length > 0 ? row.engines : [{ engine: "ai_overview", cell: row.cell }];
    const byEngine = new Map<string, AnswerCell>(columns.map((column) => [column.engine, column.cell]));
    for (const engine of ANSWER_ENGINES) {
      const cell = byEngine.get(engine);
      if (cell === undefined || cell.kind === "unmeasured") continue;
      namedOf += 1;
      for (const domain of domains) {
        if (reachesYou(markOf(cell, domain))) named.set(domain, (named.get(domain) ?? 0) + 1);
      }
    }
  }

  // ── The searches the rivals win and the site does not.
  const own = new Set((report?.ownRankedRows ?? []).map((row) => row.keyword.trim().toLowerCase()));
  const places = positionsOf(report, tracked);
  const pool: RivalPoolFacts[] = [];
  const seen = new Set<string>();
  for (const row of report?.market.kind === "unmeasured" ? [] : (report?.market.value.pool ?? [])) {
    const rival = row.rival === null ? null : tracked.find((domain) => isTheirs(domain, [row.rival as string]));
    if (rival === undefined || rival === null) continue;
    const key = row.keyword.trim().toLowerCase();
    // The site already ranks for it, so it is not a search a rival wins and
    // the customer does not — it is one they are both in.
    if (own.has(key)) continue;
    // One row per search: the pool carries a row per rival per keyword, and
    // a table that drew the same search three times would be a list of
    // rivals wearing a list of searches' clothes.
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({
      search: row.keyword,
      volume: counted(row.volume, at),
      rival,
      position: places.get(`${rival}\u0000${key}`) ?? notTaken(at),
      status: statuses.get(key) ?? "needs_page",
    });
  }

  return {
    rivals: tracked,
    ownDomain: site.domain,
    firstPage,
    firstPageOf,
    named,
    namedOf,
    firstPageAtStart: await startedAt(site, domains, at),
    firstPageHolders: holdersOf(serps, domains),
    pool,
    // One date governs the whole blob (`src/lib/scan/report.ts`): the
    // verdict's own `measuredAt`.
    measuredAt: report?.verdict.measuredAt ?? null,
  };
}

/** Whether a domain holds a first-page place on one measured search: one
 *  of the ten, or the local pack above them (SPEC §6, D67) — the same
 *  reading the rivals are chosen by (issue 1365). */
export function onFirstPage(serp: SerpResult, domain: string): boolean {
  return (
    serp.organic.some((row) => row.position <= FIRST_PAGE && isTheirs(domain, [row.domain])) ||
    (serp.localPack ?? []).some((row) => isTheirs(domain, [row.domain]))
  );
}

/**
 * The sites that hold the most of the measured first pages and are neither
 * the customer's nor a tracked rival's (SPEC §4, 2026-10-09, issue 1365):
 * who the card names where no rival is there. A forum or a social network
 * is not a business and is never named. Most places first, then the better
 * place.
 */
export function holdersOf(
  serps: NonNullable<StoredReport["serps"]>,
  tracked: readonly string[]
): string[] {
  const tally = new Map<string, { places: number; best: number }>();
  for (const serp of serps) {
    if (serp.kind === "unmeasured") continue;
    const here = new Map<string, number>();
    for (const row of [...(serp.value.localPack ?? []).map((local) => ({ ...local, position: 0 })), ...serp.value.organic]) {
      if (row.position > FIRST_PAGE) continue;
      const domain = registrableDomain(row.domain);
      if (domain === null || here.has(domain) || isPlatformDomain(row.domain)) continue;
      if (tracked.some((mine) => isTheirs(mine, [domain]))) continue;
      here.set(domain, row.position);
    }
    for (const [domain, position] of here) {
      const held = tally.get(domain);
      if (held === undefined) tally.set(domain, { places: 1, best: position });
      else tally.set(domain, { places: held.places + 1, best: Math.min(held.best, position) });
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1].places - a[1].places || a[1].best - b[1].best || a[0].localeCompare(b[0]))
    .slice(0, RIVAL_PRESENCE.HOLDERS)
    .map(([domain]) => domain);
}

/**
 * Where each tracked rival stands on each of the twelve, keyed
 * `rival\0search`.
 *
 * The pool is the rivals' whole ranked footprint and carries no position at
 * all, so this is the only place on this screen a place can honestly come
 * from: the top tens the pass actually bought. Every other row states the
 * dash, which is what REQ-004 asks of a reading nobody took.
 */
function positionsOf(
  report: StoredReport | null,
  tracked: readonly string[]
): ReadonlyMap<string, Measured<number>> {
  const places = new Map<string, Measured<number>>();
  const questions = report?.questions;
  if (report === null || questions === undefined || questions.kind === "unmeasured") return places;
  questions.value.forEach((question, i) => {
    const serp = report.serps[i];
    if (serp === undefined || serp.kind === "unmeasured") return;
    const key = question.search.keyword.trim().toLowerCase();
    for (const rival of tracked) {
      const row = serp.value.organic.find((organic) => isTheirs(rival, [organic.domain]));
      if (row === undefined) continue;
      places.set(`${rival}\u0000${key}`, measured(row.position, report.verdict.measuredAt));
    }
  });
  return places;
}

/**
 * How many of the twelve the customer was on the first page for in the
 * **first** week this window measured — the "when you started" line.
 *
 * `null` where the window read only one week: there is then no earlier
 * reading to have started from, and a line comparing this week with itself
 * would be a zero dressed as a change.
 */
async function startedAt(
  site: RivalsSite,
  domains: readonly string[],
  at: Date
): Promise<number | null> {
  const weeks: string[] = [weekStartFor({ at, zone: site.timeZone })];
  for (let back = 1; back < OVERVIEW_TRAILING_WEEKS; back += 1) {
    weeks.unshift(previousWeekStart(weeks[0] as string));
  }
  const scans = await readWeekScans({ siteId: site.siteId, weekStarts: weeks }).catch(() => null);
  if (scans === null) return null;
  const measuredWeeks = weeks.filter((week) => scans.get(week)?.report != null);
  if (measuredWeeks.length < 2) return null;
  const first = scans.get(measuredWeeks[0] as string)?.report ?? null;
  if (first === null) return null;
  const own = domains[domains.length - 1] as string;
  let count = 0;
  for (const serp of first.serps) {
    if (serp.kind === "unmeasured") continue;
    if (onFirstPage(serp.value, own)) count += 1;
  }
  return count;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  neq(column: string, value: unknown): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

interface StatusRow {
  target_query: string | null;
  status: string;
  ready: boolean;
  unready_reason: string | null;
}

/**
 * What ReachKit is doing about each search it already holds a row for.
 *
 * Three of the table's four words are decided here; the fourth —
 * `needs_page` — is the absence of a row and is filled in by the caller,
 * because "nothing on file" is not a status a row can carry.
 *
 * `in_review` is any row that has left `open`: the page has been written
 * and is the customer's to read. `too_big` is exactly `unready_reason =
 * 'outsized'` (SPEC §6's right-sizing law), the one unready reason that is
 * about the market rather than about ReachKit's own plumbing — the same
 * rule, and the same spelling, as the Search tab's `statusOf`.
 */
async function readStatuses(siteId: string): Promise<ReadonlyMap<string, RivalSearchStatus>> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from<StatusRow>("opportunities")
    .select("target_query, status, ready, unready_reason")
    .eq("site_id", siteId)
    .neq("family", "fix");
  if (error !== null || data === null) throw new Error(`rivals: opportunities — ${error?.message ?? "no rows"}`);

  const statuses = new Map<string, RivalSearchStatus>();
  for (const row of data) {
    const search = row.target_query;
    if (search === null) continue;
    const key = search.trim().toLowerCase();
    const status: RivalSearchStatus =
      row.status !== "open" ? "in_review" : row.unready_reason === "outsized" ? "too_big" : "up_next";
    // A search with two rows keeps the one furthest along: a page already
    // written is what the customer can act on, whatever else is on file.
    const held = statuses.get(key);
    if (held === undefined || RANK[status] < RANK[held]) statuses.set(key, status);
  }
  return statuses;
}

/** Which of two rows for one search the table states. Smaller wins. */
const RANK: Readonly<Record<RivalSearchStatus, number>> = Object.freeze({
  in_review: 0,
  up_next: 1,
  needs_page: 2,
  too_big: 3,
});
