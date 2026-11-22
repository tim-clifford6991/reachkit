// SPEC §4 *Competitors tab* — the tab's facts for a real account, projected
// from the stored weekly report and the opportunities; it measures and buys
// nothing. A host is matched to a domain by the score's own `classifyReferences`.
import { dbAdmin } from "@/lib/db";
import { classifyReferences } from "@/lib/measure/drivers";
import type { StoredReport } from "@/lib/scan/report";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { previousWeekStart, readWeekScans, weekStartFor } from "@/lib/scan/weekly";
import { OVERVIEW_TRAILING_WEEKS, RIVAL_PRESENCE } from "@/lib/config/constants";
import { isPlatformDomain, registrableDomain, resolvedRows } from "@/lib/market/rivals/domains";
import { trackedRivals } from "@/lib/market/rivals/tracked";
import type { RivalSearchRow, RivalSearchStatus, RivalsFacts } from "./rivals-model";

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

/** How deep the site's own place is stated. */
const OWN_DEPTH = 100;

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
    if (serp.kind === "unmeasured" || resolvedRows(serp.value.organic) === null) continue;
    firstPageOf += 1;
    for (const domain of domains) {
      if (onFirstPage(serp.value, domain)) firstPage.set(domain, (firstPage.get(domain) ?? 0) + 1);
    }
  }

  const rows = rowsOf(report, site.domain, tracked, statuses);

  return {
    rivals: tracked,
    ownDomain: site.domain,
    firstPage,
    firstPageOf,
    firstPageAtStart: await startedAt(site, domains, at),
    firstPageHolders: holdersOf(serps, domains),
    rows,
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
    (resolvedRows(serp.organic) ?? []).some((row) => row.position <= FIRST_PAGE && isTheirs(domain, [row.domain])) ||
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
    const organic = resolvedRows(serp.value.organic);
    if (organic === null) continue;
    const here = new Map<string, number>();
    for (const row of [...(serp.value.localPack ?? []).map((local) => ({ ...local, position: 0 })), ...organic]) {
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

/** Best organic place of a domain in the top ten, or `null`. Competitors are read no deeper: the pass buys ten (`VENDOR.serpDepth`). */
function placeIn(organic: readonly { domain: string; position: number }[], domain: string): number | null {
  const places = organic.filter((row) => row.position <= FIRST_PAGE && isTheirs(domain, [row.domain])).map((row) => row.position);
  return places.length === 0 ? null : Math.min(...places);
}

/** One row per search of the twelve whose top ten was read; a search not read is left out, never shown as an absence. */
export function rowsOf(
  report: StoredReport | null,
  ownDomain: string,
  tracked: readonly string[],
  statuses: ReadonlyMap<string, RivalSearchStatus>
): RivalSearchRow[] {
  const questions = report?.questions;
  if (report === null || questions === undefined || questions.kind === "unmeasured") return [];
  // The site's place below the first page comes from its own ranked rows, which reach 100.
  const ranked = new Map<string, number>();
  for (const row of report.ownRankedRows) {
    const key = row.keyword.trim().toLowerCase();
    if (row.position <= OWN_DEPTH && row.position < (ranked.get(key) ?? Infinity)) ranked.set(key, row.position);
  }
  const rows: RivalSearchRow[] = [];
  questions.value.forEach((question, i) => {
    const serp = report.serps[i];
    const organic = serp === undefined || serp.kind === "unmeasured" ? null : resolvedRows(serp.value.organic);
    if (organic === null) return;
    const key = question.search.keyword.trim().toLowerCase();
    const you = placeIn(organic, ownDomain) ?? ranked.get(key) ?? null;
    const places: Record<string, number> = {};
    for (const rival of tracked) {
      const place = placeIn(organic, rival);
      if (place !== null) places[rival] = place;
    }
    const status = statuses.get(key) ?? (you !== null && you <= FIRST_PAGE ? "live" : "needs_page");
    rows.push({ search: question.search.keyword, volume: question.search.volume, you, places, status });
  });
  return rows;
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
  live: 4,
});
