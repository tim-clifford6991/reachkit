// BUILD §11 — the four reads and two writes the weekly measurement needs
//
// Every statement this module sends is here, so the selection, the run and
// the account each hold one rule and no SQL. Nothing below decides
// anything: due-ness is `week.ts`'s, active access is billing's
// (`access.ts`), and what a degraded week did not reach is `account.ts`'s.
//
// **The claim is the exactly-once mechanism, and the index is what makes
// it true.** `claimWeek` inserts the `running` row *before* a cent is
// spent, carrying `week_start`; the partial unique index
// `(site_id, week_start) where tier = 'weekly'`
// (`supabase/migrations/20260906120000_scans_weekly.sql`) rejects the
// second insert, and that rejection is the answer "already measured" —
// not an error, and not a read-then-write race two ticks can both win.
// `week_start` is written once, at insert, and no statement here ever
// updates it: a week's label must not move when a customer moves zone.
//
// **A claim that produced no report is released.** `releaseWeek` deletes
// the row, which is what lets the next hourly tick retry the site inside
// the same site-local week (a crash leaves no week behind it). A run that
// produced a report — `done` or `degraded` — keeps its row and is never
// retried: a partly measured week is a measured week that says what it
// missed, not a failure to repeat.
//
// `scans.week_start` and `scans.finished_at` are on disk and not in the
// generated `Database` type, which has not been regenerated since. Every
// query here goes through one narrow, explicitly cast builder against a
// locally declared row shape — the same worked-around gap `admission.ts`,
// `report.ts`, `correction.ts` and `run.ts` already carry.
import { dbAdmin } from "@/lib/db";
import { readStoredReport, type StoredReport } from "../report";

/** One site, as the weekly tick needs it: who it is, what it measures and
 *  which clock decides its Monday. */
export interface SiteRow {
  readonly siteId: string;
  readonly domain: string;
  readonly zone: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  delete(): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface SiteQueryRow {
  id: string;
  domain: string;
  timezone: string | null;
}

/**
 * Every site that carries a zone, with the domain it measures.
 *
 * One indexed read, and deliberately not filtered by access: whose access
 * is current is billing's single gate to answer (`access.ts`), and a
 * second predicate here would be a second definition of active. A site
 * whose `timezone` is still null has not finished first sign-in (REQ-073
 * c1 forbids a zone the customer did not state), and there is no zone in
 * which to decide its Monday — so it is not selected, and no server-chosen
 * fallback puts it on the wrong day.
 */
export async function sitesWithAZone(): Promise<readonly SiteRow[]> {
  const { data, error } = await untyped()
    .from<SiteQueryRow>("sites")
    .select("id, domain, timezone")
    .not("timezone", "is", null);
  if (error) throw new Error(`weekly: could not read the sites: ${error.message}`);
  const rows: SiteRow[] = [];
  for (const row of data ?? []) {
    if (row.timezone === null) continue;
    rows.push({ siteId: row.id, domain: row.domain, zone: row.timezone });
  }
  return rows;
}

interface WeekRow {
  id: string;
  site_id: string;
  week_start: string;
  status: string;
  report: unknown;
}

/** The `(site_id, week_start)` pairs that already carry a weekly scan row,
 *  as the keys `weekKey()` spells. One read for the whole tick, never one
 *  per site. */
export async function weeksAlreadyStamped(
  siteIds: readonly string[],
  weekStarts: readonly string[]
): Promise<ReadonlySet<string>> {
  if (siteIds.length === 0) return new Set();
  const { data, error } = await untyped()
    .from<WeekRow>("scans")
    .select("site_id, week_start")
    .eq("tier", "weekly")
    .in("site_id", siteIds)
    .in("week_start", weekStarts);
  if (error) throw new Error(`weekly: could not read the measured weeks: ${error.message}`);
  return new Set((data ?? []).map((row) => `${row.site_id}:${row.week_start}`));
}

/** Postgres' unique-violation, which PostgREST passes through as its own
 *  code. The one rejection this module reads as an answer rather than a
 *  fault. */
const UNIQUE_VIOLATION = "23505";

export type Claim = { readonly claimed: true; readonly scanId: string } | { readonly claimed: false };

/**
 * Inserts the `running` row for one site's week, before any spend.
 *
 * The id is generated here and handed to `runScan`, which writes its
 * report to this very row: one row per site per week, from the claim to
 * the report, so a pass never inserts a second one behind the index's
 * back.
 */
export async function claimWeek(a: {
  siteId: string;
  domain: string;
  weekStart: string;
}): Promise<Claim> {
  const scanId = crypto.randomUUID();
  const { error } = await untyped()
    .from<WeekRow>("scans")
    .insert({
      id: scanId,
      site_id: a.siteId,
      domain: a.domain,
      tier: "weekly",
      status: "running",
      week_start: a.weekStart,
    });
  if (error === null) return { claimed: true, scanId };
  if (error.code === UNIQUE_VIOLATION) return { claimed: false };
  throw new Error(`weekly: could not claim the week: ${error.message}`);
}

/** Releases a claim that produced no report, so the next hourly tick
 *  retries the site inside the same site-local week. */
export async function releaseWeek(scanId: string): Promise<void> {
  const { error } = await untyped().from<WeekRow>("scans").delete().eq("id", scanId);
  if (error) throw new Error(`weekly: could not release the claim: ${error.message}`);
}

/** One site's week as it stands: the row, its status, and the report it
 *  stored. `null` where the week has no row at all. */
export interface WeekScan {
  readonly scanId: string;
  readonly status: string;
  readonly report: StoredReport | null;
}

/** One lookup off `(site_id, week_start)` — the account is on the render
 *  path of every app screen, so it asks the database once. */
export async function readWeekScan(a: { siteId: string; weekStart: string }): Promise<WeekScan | null> {
  const { data, error } = await untyped()
    .from<WeekRow>("scans")
    .select("id, status, report")
    .eq("site_id", a.siteId)
    .eq("tier", "weekly")
    .eq("week_start", a.weekStart)
    .limit(1);
  if (error) throw new Error(`weekly: could not read the week: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) return null;
  return {
    scanId: row.id,
    status: row.status,
    report: row.report === null || row.report === undefined ? null : readStoredReport(row.report),
  };
}

/**
 * Several of one site's weeks, in one read (issue #213).
 *
 * `readWeekScan` above is the account's reader — one week, one lookup, on
 * the render path of a screen that states one week. A *series* is a
 * different question, and asking the single reader twelve times would put
 * twelve round trips on Overview's render path. So: one `in` over the
 * window's Mondays, keyed back by `week_start`.
 *
 * **Only the weeks that have a row come back.** The map is missing rather
 * than empty for a week the site was not measured in, because those are
 * two different facts and the caller draws them differently: an absent
 * week is a break in a series, and inventing an entry for it here would be
 * the one thing REQ-004 forbids — a reading where no measurement was made.
 *
 * An empty `weekStarts` asks nothing: a site whose window is empty has no
 * question to put to the database.
 */
export async function readWeekScans(a: {
  siteId: string;
  weekStarts: readonly string[];
}): Promise<ReadonlyMap<string, WeekScan>> {
  if (a.weekStarts.length === 0) return new Map();
  const { data, error } = await untyped()
    .from<WeekRow>("scans")
    .select("id, week_start, status, report")
    .eq("site_id", a.siteId)
    .eq("tier", "weekly")
    .in("week_start", a.weekStarts);
  if (error) throw new Error(`weekly: could not read the weeks: ${error.message}`);

  const weeks = new Map<string, WeekScan>();
  for (const row of data ?? []) {
    weeks.set(row.week_start, {
      scanId: row.id,
      status: row.status,
      report: row.report === null || row.report === undefined ? null : readStoredReport(row.report),
    });
  }
  return weeks;
}

/** The zone one site's Monday is decided in, or `null` where the customer
 *  has stated none yet. */
export async function readSiteZone(siteId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<SiteQueryRow>("sites")
    .select("id, domain, timezone")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`weekly: could not read the site's zone: ${error.message}`);
  return data?.[0]?.timezone ?? null;
}
