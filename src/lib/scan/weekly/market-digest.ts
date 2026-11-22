// The owner's Monday digest. A site's first (deep) pass that found too little market mails at once; weekly passes fold into one mail per Monday,
// sent by the maintenance tick once that Monday has ended in every zone (UTC−12 leaves it at Tuesday 12:00 UTC). Only that one week is ever due:
// a week the tick missed is not mailed late.
// Once: `scans.market_digest_at` is stamped on every weekly row read, only when the seam accepted the mail; a refusal stamps nothing and the
// next tick retries. `running` and `failed` rows are not read; one that later finishes too small is sent alone.
// The same mail carries, each left out where its read fails and never holding the digest back: each paying site's daily-promise line
// (`./promise-week`), its visits and clicks (`./visits-week`) and its untold empty days; the week's cost (`./cost-week`); the passes a health check failed on;
// live hosted pages Google has not crawled `UNCRAWLED_AFTER_D` days after going live; and each site's market changes and how many were cited.
import { tz } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { UNCRAWLED_AFTER_D } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { marketTooSmall, stoppedOnCeiling } from "../market-floor";
import { readStoredReport } from "../report";
import type { OpsIncident } from "@/lib/mail/templates/ops";
import type { UnhealthyPass } from "../health-record";
import type { CostWeek } from "./cost-week";
import type { PromiseWeek } from "./promise-week";
import type { VisitsWeek } from "./visits-week";

// `scans.week_start` and `scans.market_digest_at` are not in the generated `Database` type; the same narrow cast as `./store`.
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

/** `day` moved by whole days, as the calendar date it lands on. */
function shiftDay(day: string, delta: number): string {
  return format(addDays(day, delta, { in: tz("UTC") }), "yyyy-MM-dd");
}

/** Each paying site's promise line (`./promise-week`), or `null` where none pays or it could not be read. */
async function promiseOf(weekStart: string): Promise<PromiseWeek | null> {
  try {
    const { readPromiseWeek } = await import("./promise-week");
    return await readPromiseWeek(shiftDay(weekStart, -7), weekStart);
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_promise_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** Each paying hosted site's visits and clicks (`./visits-week`), or `null` where none is hosted or they could not be read. */
async function visitsOf(weekStart: string): Promise<VisitsWeek | null> {
  try {
    const { readVisitsWeek } = await import("./visits-week");
    return await readVisitsWeek(shiftDay(weekStart, -7));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_visits_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

type UntoldWeek = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["untold"]>;

/** The week before `weekStart`'s days with no page that no alert was sent for, or `null` where there is none or they
 *  could not be read. */
async function untoldBefore(weekStart: string): Promise<UntoldWeek | null> {
  try {
    const { untoldMisses } = await import("@/lib/publish/daily");
    const days = await untoldMisses({ from: shiftDay(weekStart, -7), to: shiftDay(weekStart, -1) });
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

type ChangesWeek = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["changes"]>;

/** Each site's market changes the week before `weekStart` recorded, and how many of them that week's drafts cite; `null`
 *  where no site recorded a week or they could not be read. */
async function changesBefore(weekStart: string): Promise<ChangesWeek | null> {
  try {
    const from = shiftDay(weekStart, -7);
    const { readMarketChanges } = await import("./store");
    const weeks = await readMarketChanges({ from, to: from });
    if (weeks.length === 0) return null;
    const ids = weeks.map((week) => week.siteId);
    const [sites, drafts] = await Promise.all([
      untyped().from<SiteRow>("sites").select("id, domain").in("id", ids),
      untyped().from<{ site_id: string; meta: { marketFacts?: { url?: unknown }[] } | null }>("drafts").select("site_id, meta").in("site_id", ids).gte("created_at", `${from}T00:00:00Z`).lt("created_at", `${weekStart}T00:00:00Z`),
    ]);
    if (sites.error || drafts.error) throw new Error((sites.error ?? drafts.error)!.message);
    const domains = new Map((sites.data ?? []).map((site) => [site.id, site.domain]));
    return {
      weekStart: from,
      sites: weeks
        .map((week) => {
          const cited = new Set((drafts.data ?? []).filter((draft) => draft.site_id === week.siteId).flatMap((draft) => (draft.meta?.marketFacts ?? []).map((fact) => fact.url)));
          const changes = week.changes as { claims?: { url?: unknown }[] }[];
          return { domain: domains.get(week.siteId) ?? "unknown", recorded: changes.length, cited: changes.filter((change) => (change.claims ?? []).some((claim) => cited.has(claim.url))).length };
        })
        .sort((a, b) => a.domain.localeCompare(b.domain)),
    };
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_changes_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** What the week before `weekStart` cost, or `null` where it held nothing or
 *  could not be read. */
async function costBefore(weekStart: string): Promise<CostWeek | null> {
  try {
    const { readCostWeek } = await import("./cost-week");
    return await readCostWeek(shiftDay(weekStart, -7));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_costs_unread", error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

/** The passes a health check failed on since the digest before this one fell due, or `null` where none or unreadable. */
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

type UncrawledWeek = NonNullable<Extract<OpsIncident, { occasion: "market-too-small-week" }>["uncrawled"]>;

/** The live hosted pages Google had not crawled `UNCRAWLED_AFTER_D` days after going live, or `null` where there are
 *  none or they could not be read. */
async function uncrawledAt(now: Date): Promise<UncrawledWeek | null> {
  try {
    const { readingOf, uncrawled } = await import("@/lib/measure/page-reading");
    const live = await untyped()
      .from<{ site_id: string; live_url: string | null; published_at: string | null; search_reading: unknown }>("publications")
      .select("site_id, live_url, published_at, search_reading")
      .eq("destination", "hosted")
      .is("unpublished_at", null);
    if (live.error) throw new Error(live.error.message);
    const pages = (live.data ?? []).flatMap((row) => {
      const google = readingOf(row.search_reading)?.google;
      const due = Date.parse(row.published_at ?? "") <= now.getTime() - UNCRAWLED_AFTER_D * DAY_MS;
      return row.live_url !== null && due && uncrawled(google) ? [{ siteId: row.site_id, url: row.live_url, state: google!.coverageState!, published: row.published_at!.slice(0, 10) }] : [];
    });
    if (pages.length === 0) return null;
    const sites = await untyped().from<SiteRow>("sites").select("id, domain").in("id", [...new Set(pages.map((page) => page.siteId))]);
    if (sites.error) throw new Error(sites.error.message);
    const domains = new Map((sites.data ?? []).map((site) => [site.id, site.domain]));
    return pages
      .map(({ siteId, ...page }) => ({ domain: domains.get(siteId) ?? "unknown", ...page }))
      .sort((a, b) => a.domain.localeCompare(b.domain) || a.published.localeCompare(b.published));
  } catch (error) {
    console.warn(JSON.stringify({ event: "market_digest_uncrawled_unread", error: error instanceof Error ? error.name : "unknown" }));
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
 * that found too little market, each paying site's promise line and what
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
      // A pass a ceiling stopped did not finish reading its market.
      if (marketTooSmall(report.questions) && !stoppedOnCeiling(report.stoppedReason)) tooSmall.push(row.id);
    } catch {
      // A report this build cannot read is not a market this digest can judge.
      console.warn(JSON.stringify({ event: "market_digest_unreadable_report", scanId: row.id }));
    }
  }

  const promise = await promiseOf(weekStart);
  const visits = await visitsOf(weekStart);
  const untold = await untoldBefore(weekStart);
  const costs = await costBefore(weekStart);
  const unhealthy = await unhealthyBefore(weekStart);
  const uncrawled = await uncrawledAt(now);
  const changes = await changesBefore(weekStart);
  if (tooSmall.length > 0 || promise !== null || visits !== null || untold !== null || costs !== null || unhealthy !== null || uncrawled !== null || changes !== null) {
    const { reportIncident } = await import("@/lib/mail/ops");
    const accepted = await reportIncident({
      occasion: "market-too-small-week",
      weekStart,
      scanIds: tooSmall,
      ...(promise === null ? {} : { promise }),
      ...(visits === null ? {} : { visits }),
      ...(untold === null ? {} : { untold }),
      ...(costs === null ? {} : { costs }),
      ...(unhealthy === null ? {} : { unhealthy }),
      ...(uncrawled === null ? {} : { uncrawled }),
      ...(changes === null ? {} : { changes }),
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
  console.log(JSON.stringify({ event: "market_digest", weekStart, read: ids.length, tooSmall: tooSmall.length, promiseSites: promise?.sites.length ?? 0, visitsSites: visits?.sites.length ?? 0, untold: untold?.length ?? 0, costs: costs !== null, drifting: costs?.drift?.sources.length ?? 0, unhealthy: unhealthy?.length ?? 0, uncrawled: uncrawled?.length ?? 0, changesSites: changes?.sites.length ?? 0 }));
  return true;
}
