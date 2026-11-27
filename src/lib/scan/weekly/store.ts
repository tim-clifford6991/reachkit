// BUILD §11: every statement the weekly measurement sends, so the selection, run and account each hold a rule and no SQL. Nothing here decides.
// `claimWeek` inserts the `running` row with `week_start` before any spend, and the partial unique index `(site_id, week_start) where tier = 'weekly'`
// rejects a second insert: that rejection is "already measured", not a race. `week_start` moves only when a test site's re-run supersedes the week.
// `releaseWeek` marks a reportless claim `failed` and keeps it (`fetches.scan_id` references it); `claimWeek` retakes it on the next tick, and
// readers treat `failed` as no week. A `done` or `degraded` row is never retried.
// `scans.week_start` and `scans.finished_at` are not in the generated `Database` type, so every query uses one narrow cast against a local row shape.
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
  update(values: Record<string, unknown>): MinimalQueryBuilder<T>;
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

/** Every site that carries a zone, with its domain. Not filtered by access, which is billing's one gate; a site with a null `timezone` has not
 *  finished first sign-in and has no Monday, so it is not selected and no fallback zone is chosen. */
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
    .select("site_id, week_start, status")
    .eq("tier", "weekly")
    .in("site_id", siteIds)
    .in("week_start", weekStarts);
  if (error) throw new Error(`weekly: could not read the measured weeks: ${error.message}`);
  return new Set((data ?? []).filter(isAWeek).map((row) => `${row.site_id}:${row.week_start}`));
}

/** Every weekly row of these site-local Mondays, keyed as `weekKey()` spells
 *  it, with its status. One read for the whole tick, bounded by the weeks
 *  rather than by a list of sites. */
export async function weekStatuses(weekStarts: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const { data, error } = await untyped()
    .from<WeekRow>("scans")
    .select("site_id, week_start, status")
    .eq("tier", "weekly")
    .in("week_start", weekStarts);
  if (error) throw new Error(`weekly: could not read the measured weeks: ${error.message}`);
  return new Map((data ?? []).map((row) => [`${row.site_id}:${row.week_start}`, row.status]));
}

/** A released claim's row is kept for the ledger, and is no week. */
function isAWeek(row: { status?: string }): boolean {
  return row.status !== "failed";
}

/** Postgres' unique-violation, which PostgREST passes through as its own
 *  code. The one rejection this module reads as an answer rather than a
 *  fault. */
const UNIQUE_VIOLATION = "23505";

export type Claim = { readonly claimed: true; readonly scanId: string; readonly retaken?: true } | { readonly claimed: false };

/** Inserts the `running` row for one site's week before any spend; `runScan` writes its report to this row, so a pass never inserts a second. */
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
  if (error.code !== UNIQUE_VIOLATION) throw new Error(`weekly: could not claim the week: ${error.message}`);

  // The week's row exists; a released one is taken back, and the status filter lets only one tick win it.
  const retaken = await untyped()
    .from<WeekRow>("scans")
    .update({ status: "running" })
    .eq("site_id", a.siteId)
    .eq("tier", "weekly")
    .eq("week_start", a.weekStart)
    .eq("status", "failed")
    .select("id");
  if (retaken.error) throw new Error(`weekly: could not claim the week: ${retaken.error.message}`);
  const row = retaken.data?.[0];
  return row === undefined ? { claimed: false } : { claimed: true, scanId: row.id, retaken: true };
}

/** A re-run's own `running` row, stamped with no week until it finishes, so its `WEEK` budget reads 0¢ and the week's row stands meanwhile. */
export async function claimRerun(a: { siteId: string; domain: string }): Promise<Claim> {
  const scanId = crypto.randomUUID();
  const { error } = await untyped().from<WeekRow>("scans").insert({ id: scanId, site_id: a.siteId, domain: a.domain, tier: "weekly", status: "running" });
  if (error) throw new Error(`weekly: could not claim the re-run: ${error.message}`);
  return { claimed: true, scanId };
}

/** A finished re-run takes the week: the standing row leaves it, kept for its ledger, and the re-run's row is stamped with it. The owner's
 *  market digest stays sent, and so does the Monday mail unless the re-run sends it again. */
export async function supersedeWeek(a: { siteId: string; weekStart: string; scanId: string; mail: boolean }): Promise<void> {
  const left = await untyped()
    .from<{ market_digest_at: string | null; digest_sent_at: string | null }>("scans")
    .update({ week_start: null })
    .eq("site_id", a.siteId)
    .eq("tier", "weekly")
    .eq("week_start", a.weekStart)
    .select("market_digest_at, digest_sent_at");
  if (left.error) throw new Error(`weekly: could not supersede the week: ${left.error.message}`);
  const standing = left.data?.[0];
  const told = standing === undefined ? {} : { market_digest_at: standing.market_digest_at, ...(a.mail ? {} : { digest_sent_at: standing.digest_sent_at }) };
  const took = await untyped().from<WeekRow>("scans").update({ week_start: a.weekStart, ...told }).eq("id", a.scanId);
  if (took.error) throw new Error(`weekly: could not supersede the week: ${took.error.message}`);
}

/** Releases a claim that measured nothing, so the next hourly tick retries
 *  the site inside the same site-local week. The row stays: the ledger's
 *  rows reference it. */
export async function releaseWeek(scanId: string): Promise<void> {
  const { error } = await untyped().from<WeekRow>("scans").update({ status: "failed" }).eq("id", scanId);
  if (error) throw new Error(`weekly: could not release the claim: ${error.message}`);
}

/** What the row's ledger holds so far, in cents; the database keeps `cost_cents` summed from it. */
export async function scanCents(scanId: string): Promise<number> {
  const { data, error } = await untyped().from<{ cost_cents: number | null }>("scans").select("cost_cents").eq("id", scanId).limit(1);
  if (error) throw new Error(`weekly: could not read the pass's spend: ${error.message}`);
  return Number(data?.[0]?.cost_cents ?? 0) || 0;
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
  if (row === undefined || !isAWeek(row)) return null;
  return {
    scanId: row.id,
    status: row.status,
    report: row.report === null || row.report === undefined ? null : readStoredReport(row.report),
  };
}

/** Several of one site's weeks in one read, so Overview's series costs one round trip. Only weeks with a row come back: an absent week is a break
 *  in the series, and inventing an entry would be a reading where no measurement was made. An empty `weekStarts` asks nothing. */
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
  for (const row of (data ?? []).filter(isAWeek)) {
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

/** Inserts one site's market week before any of its news is bought: `false` where the week already has its row. */
export async function claimMarketWeek(a: { siteId: string; weekStart: string; scanId: string }): Promise<boolean> {
  const { error } = await dbAdmin().from("market_changes").insert({ site_id: a.siteId, week_start: a.weekStart, scan_id: a.scanId });
  if (error === null) return true;
  if (error.code !== UNIQUE_VIOLATION) throw new Error(`weekly: could not claim the market week: ${error.message}`);
  // Only a re-run's row differs from the week's claimant, and it takes the week over, its changes kept to add to; the same row again is one claim.
  const taken = await dbAdmin().from("market_changes").update({ scan_id: a.scanId }).eq("site_id", a.siteId).eq("week_start", a.weekStart).neq("scan_id", a.scanId).select("site_id");
  if (taken.error) throw new Error(`weekly: could not claim the market week: ${taken.error.message}`);
  return (taken.data ?? []).length > 0;
}

export async function storeMarketChanges(a: { siteId: string; weekStart: string; changes: readonly object[] }): Promise<void> {
  const { error } = await dbAdmin().from("market_changes").update({ changes: JSON.parse(JSON.stringify(a.changes)) }).eq("site_id", a.siteId).eq("week_start", a.weekStart);
  if (error) throw new Error(`weekly: could not store the market changes: ${error.message}`);
}

/** The stored market weeks from `from` through `to`, of `siteIds` where named; a week whose pass stored nothing is left out. */
export async function readMarketChanges(a: { siteIds?: readonly string[]; from: string; to?: string }): Promise<{ siteId: string; weekStart: string; changes: unknown[] }[]> {
  let query = dbAdmin().from("market_changes").select("site_id, week_start, changes").gte("week_start", a.from).not("changes", "is", null);
  if (a.to !== undefined) query = query.lte("week_start", a.to);
  if (a.siteIds !== undefined) query = query.in("site_id", [...a.siteIds]);
  const { data, error } = await query;
  if (error) throw new Error(`weekly: could not read the market changes: ${error.message}`);
  return (data ?? []).map((row) => ({ siteId: row.site_id, weekStart: row.week_start, changes: Array.isArray(row.changes) ? row.changes : [] }));
}
