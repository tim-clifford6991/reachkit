// Issue 796 — the owner's Monday market digest.
//
// Issue 770 mailed the owner on every paid pass that found too little market
// (`../market-floor`), and a weekly pass is a paid pass, so a thin site
// mailed every Monday. A site's first (deep) pass still mails at once — that
// is news. A weekly pass is folded into one owner mail per Monday listing
// the scan ids, sent by the maintenance tick once that Monday has ended in
// every zone.
//
// **Which Monday.** `week_start` is the site-local Monday's calendar date,
// the same date in every zone. The last zone to leave a Monday is UTC−12,
// at Tuesday 12:00 UTC, so a week is due from then until the next one is.
// Only that one week is ever due: rows from before this shipped are never
// offered, and a week the tick missed entirely is not mailed late.
//
// **Once.** `scans.market_digest_at` is stamped on every weekly row of the
// week the digest read — too small or not — and only when the seam accepted
// the mail (or there was nothing to tell). A refusal stamps nothing and the
// next tick offers the week again. A row still `running` or `failed` is not
// read; if it finishes, or a retry finishes it, too small after the digest
// went, the next tick sends it alone.
//
// **Why pages stalled** (issue 1184). The same mail carries, per site, how
// many of the week before's pages stopped on the way to review and how often
// each cause stopped one — the seven dates before `week_start`, which is the
// last week every zone has finished. A read that fails leaves the count out
// and never holds the digest back. The same dates' days with no page that no
// alert was sent for, each with its reason, are listed after them.
//
// **What the week cost** (issue 1286, D57). The same mail carries that same
// week's cost (`./cost-week`): per site a measurement and a page written,
// free scans and smoke tests apart, and the ledger's total. It is sent
// whenever the week held a scan or a page, thin market or not, and a read
// that fails leaves it out the same way.
//
// **Which passes failed a health check** (issue 1287, D58). The same mail
// lists every pass — weekly, deep or re-measure — one of its own checks
// failed on in the seven days up to the moment this digest fell due, with
// the check and what it found. A read that fails leaves it out too.
import { dbAdmin } from "@/lib/db";
import { marketTooSmall, stoppedOnCeiling } from "../market-floor";
import { readStoredReport } from "../report";
import type { OpsIncident } from "@/lib/mail/templates/ops";
import type { UnhealthyPass } from "../health-record";
import type { CostWeek } from "./cost-week";

// `scans.week_start`, `scans.market_digest_at` are on disk and not in the
// generated `Database` type — the same narrow cast `./store` carries.
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  update(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  is(column: string, value: null): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface DigestRow {
  id: string;
  report: unknown;
}

interface SiteRow {
  id: string;
  domain: string;
}

type StoppedWeek = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["stopped"]>;

/** `day` moved by whole days, as the calendar date it lands on. */
function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** The sites with a stopped page in the week before `weekStart`, or `null`
 *  where there is none or the count could not be read. */
async function stoppedBefore(weekStart: string): Promise<StoppedWeek | null> {
  try {
    const from = addDays(weekStart, -7);
    const { stalledBySite } = await import("@/lib/publish/record/stalled-read");
    const counts = [...(await stalledBySite({ from, to: addDays(weekStart, -1) }))].filter(([, count]) => count.stopped > 0);
    if (counts.length === 0) return null;
    const sites = await untyped()
      .from<SiteRow>("sites")
      .select("id, domain")
      .in(
        "id",
        counts.map(([siteId]) => siteId)
      );
    if (sites.error) throw new Error(sites.error.message);
    const domains = new Map((sites.data ?? []).map((site) => [site.id, site.domain]));
    return {
      weekStart: from,
      sites: counts
        .map(([siteId, count]) => ({ domain: domains.get(siteId) ?? "unknown", ...count }))
        .sort((a, b) => b.stopped - a.stopped || a.domain.localeCompare(b.domain)),
    };
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_stopped_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

type UntoldWeek = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["untold"]>;

/** The week before `weekStart`'s days with no page that no alert was sent for, or `null` where there is none or they
 *  could not be read. */
async function untoldBefore(weekStart: string): Promise<UntoldWeek | null> {
  try {
    const { untoldMisses } = await import("@/lib/publish/daily");
    const days = await untoldMisses({ from: addDays(weekStart, -7), to: addDays(weekStart, -1) });
    if (days.length === 0) return null;
    const sites = await untyped()
      .from<SiteRow>("sites")
      .select("id, domain")
      .in("id", [...new Set(days.map((day) => day.siteId))]);
    if (sites.error) throw new Error(sites.error.message);
    const domains = new Map((sites.data ?? []).map((site) => [site.id, site.domain]));
    return days
      .map((day) => ({ domain: domains.get(day.siteId) ?? "unknown", date: day.publishDate, reason: day.reason }))
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.date.localeCompare(b.date));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_untold_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** What the week before `weekStart` cost, or `null` where it held nothing or
 *  could not be read. */
async function costBefore(weekStart: string): Promise<CostWeek | null> {
  try {
    const { readCostWeek } = await import("./cost-week");
    return await readCostWeek(addDays(weekStart, -7));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_costs_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** The passes a health check failed on (D58, issue 1287) since the digest
 *  before this one fell due, or `null` where there is none or they could not
 *  be read. */
async function unhealthyBefore(weekStart: string): Promise<UnhealthyPass[] | null> {
  try {
    const due = Date.parse(`${weekStart}T00:00:00.000Z`) + MONDAY_ENDS_EVERYWHERE_MS;
    const { unhealthyPassesBetween } = await import("../health-record");
    const passes = await unhealthyPassesBetween({ from: new Date(due - 7 * DAY_MS).toISOString(), to: new Date(due).toISOString() });
    return passes.length === 0 ? null : passes;
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_health_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** Monday 00:00 → Tuesday 12:00 UTC: the moment Monday has ended in UTC−12. */
const MONDAY_ENDS_EVERYWHERE_MS = 36 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The latest Monday, as `YYYY-MM-DD`, that has ended in every zone. */
export function lastEndedMonday(now: Date): string {
  const t = new Date(now.getTime() - MONDAY_ENDS_EVERYWHERE_MS);
  const sinceMonday = (t.getUTCDay() + 6) % 7;
  return new Date(t.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** A `failed` row is not a measured pass, and a later retry retakes it. */
const FINISHED = ["done", "degraded"] as const;

/** Unread, finished weekly rows of one week. */
function unread(columns: string, weekStart: string): MinimalQueryBuilder<DigestRow> {
  return untyped()
    .from<DigestRow>("scans")
    .select(columns)
    .eq("tier", "weekly")
    .eq("week_start", weekStart)
    .in("status", FINISHED)
    .is("market_digest_at", null);
}

/** The week whose digest is due, as the tick's one subject — or none. */
export async function marketDigestsDue(now: Date): Promise<readonly string[]> {
  const weekStart = lastEndedMonday(now);
  const { data, error } = await unread("id", weekStart).limit(1);
  if (error) throw new Error(`marketDigestsDue: could not read the week's passes: ${error.message}`);
  return (data ?? []).length > 0 ? [weekStart] : [];
}

/** One page of rows per tick: a larger week is finished by the next ticks. */
const ROWS_PER_DIGEST = 500;

/**
 * Reads the week's unread weekly passes, mails the owner the ids of those
 * that found too little market, why the week before's pages stalled and what
 * that week cost, and stamps every row it read. Answers
 * whether the week is settled; `false` means the mail was not accepted and
 * nothing was stamped.
 */
export async function sendMarketDigest(weekStart: string, now: Date): Promise<boolean> {
  const { data, error } = await unread("id, report", weekStart).limit(ROWS_PER_DIGEST);
  if (error) throw new Error(`sendMarketDigest: could not read the week's passes: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) return true;

  const tooSmall: string[] = [];
  for (const row of rows) {
    if (row.report === null || row.report === undefined) continue;
    try {
      const report = readStoredReport(row.report);
      // A pass a ceiling stopped did not finish reading its market (issue 855).
      if (marketTooSmall(report.questions) && !stoppedOnCeiling(report.stoppedReason)) tooSmall.push(row.id);
    } catch {
      // A report this build cannot read is not a market this digest can judge.
      console.warn(JSON.stringify({ event: "market_digest_unreadable_report", scanId: row.id }));
    }
  }

  const stopped = await stoppedBefore(weekStart);
  const untold = await untoldBefore(weekStart);
  const costs = await costBefore(weekStart);
  const unhealthy = await unhealthyBefore(weekStart);
  if (tooSmall.length > 0 || stopped !== null || untold !== null || costs !== null || unhealthy !== null) {
    const { reportIncident } = await import("@/lib/mail/ops");
    const accepted = await reportIncident({
      occasion: "market-too-small-week",
      weekStart,
      scanIds: tooSmall,
      ...(stopped === null ? {} : { stopped }),
      ...(untold === null ? {} : { untold }),
      ...(costs === null ? {} : { costs }),
      ...(unhealthy === null ? {} : { unhealthy }),
    });
    if (!accepted) return false;
  }

  const ids = rows.map((row) => row.id);
  const stamped = await untyped()
    .from<DigestRow>("scans")
    .update({ market_digest_at: now.toISOString() })
    .in("id", ids)
    .is("market_digest_at", null);
  if (stamped.error) throw new Error(`sendMarketDigest: could not stamp the week: ${stamped.error.message}`);
  console.log(JSON.stringify({ event: "market_digest", weekStart, read: ids.length, tooSmall: tooSmall.length, stoppedSites: stopped?.sites.length ?? 0, untold: untold?.length ?? 0, costs: costs !== null, drifting: costs?.drift?.sources.length ?? 0, unhealthy: unhealthy?.length ?? 0 }));
  return true;
}
