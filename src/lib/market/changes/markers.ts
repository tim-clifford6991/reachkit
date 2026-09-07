// BUILD §4.7 — the dates every series, verdict and week count breaks at.
//
// REQ-071 c12 and c13 forbid presenting the difference across a change as
// movement, in any form: no change figure, no joined line, no trend arrow,
// no rising or falling colour, no slope, and no direction, streak, badge or
// verdict stated in words. Every chart that spans such a date is broken at
// it, and a direction is computed only over a span that does not contain
// one — where every available span contains it, nothing is stated at all
// rather than restated over a shorter span.
//
// This module supplies those dates. It invents nothing and stores nothing:
// **the markers are derived from the sequence of stored scans**, each of
// which already carries the domain and the category it measured against
// (ADR-030 point 5). That is what keeps every historical number
// interpretable — the answer a number was measured under is on its own
// scan and is never overwritten by the current declared answer.
//
// **There is no change-log table, and adding one would be the same mistake
// ADR-030 names.** A log would be a second record of a fact the scans
// already carry, and the two would disagree the first time one was
// backfilled.
//
// **It reads `scans` through `@/lib/db` and never imports `src/lib/scan/`'s
// barrel** (a cycle: `src/lib/scan/**` imports `@/lib/market`). Unlike the
// setup card's facts, these rows are not pushed in by an adapter: this
// needs a *sequence* over a range, and pushing that query into `src/app/`
// would be engine logic in a route handler.
//
// The archived plan is WO-092.
import { dbAdmin } from "@/lib/db";
import type { ChangeKind } from "./declared";

/** A date a series must break at, and which answer changed on it. The date
 *  is the *measurement's* own date — the first scan measured under the new
 *  answer — because that is the date the customer reads beside every
 *  number, and a marker on any other date would break the wrong gap. */
export interface ChangeMarker {
  kind: ChangeKind;
  on: Date;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  gte(column: string, value: string): MinimalQuery<T>;
  lte(column: string, value: string): MinimalQuery<T>;
  in(column: string, values: readonly string[]): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface ScanSequenceRow {
  id: string;
  domain: string;
  report: unknown;
  created_at: string;
}

/** A scan that measured something, reduced to the two answers it was
 *  measured under and its own date. */
interface MeasuredScan {
  domain: string;
  category: string | null;
  at: Date;
}

/** The statuses a scan has to have reached to have measured anything.
 *  A `running` scan measured nothing yet and a `failed` one never will, so
 *  neither can carry a change: a marker on one would break a chart at a
 *  date no number was measured on. */
const MEASURED_STATUSES = ["done", "degraded"] as const;

function categoryOf(report: unknown): string | null {
  if (typeof report !== "object" || report === null) return null;
  const category = (report as Record<string, unknown>).category;
  return typeof category === "string" ? category : null;
}

function measuredAtOf(report: unknown, createdAt: string): Date {
  if (typeof report === "object" && report !== null) {
    const verdict = (report as Record<string, unknown>).verdict;
    if (typeof verdict === "object" && verdict !== null) {
      const at = (verdict as Record<string, unknown>).measuredAt;
      if (typeof at === "string") return new Date(at);
    }
  }
  return new Date(createdAt);
}

/** Every scan this site measured, oldest first. One indexed query. */
async function measuredScans(siteId: string): Promise<MeasuredScan[]> {
  const { data, error } = await untyped()
    .from<ScanSequenceRow>("scans")
    .select("id, domain, report, created_at")
    .eq("site_id", siteId)
    .in("status", MEASURED_STATUSES)
    .order("created_at", { ascending: true });
  if (error !== null) throw new Error(`changeMarkers: ${error.message}`);
  return (data ?? []).map((row) => ({
    domain: row.domain,
    category: categoryOf(row.report),
    at: measuredAtOf(row.report, row.created_at),
  }));
}

/**
 * Every date in the range at which an answer this site is measured under
 * changed, oldest first.
 *
 * A marker sits on the **later** scan of each adjacent pair that disagrees
 * — the first measurement taken under the new answer. That is the date the
 * customer reads on the new number, and it is the gap the chart breaks at:
 * everything before it was measured under the old answer, everything from
 * it under the new.
 *
 * The first scan carries no marker. Nothing preceded it, so there is no gap
 * to break and no change to state — a marker there would say the answer
 * changed on the day the product started measuring.
 *
 * The rival set is deliberately **not** a marker kind here. REQ-071 c12 and
 * c13 break series at a *question set* change and a *domain* change; a
 * rival set changes who a page is compared against, and c8's own rule is
 * that the comparison simply shows the current set from the next
 * re-measurement. Breaking every chart on a rival edit would state a
 * discontinuity the requirement does not claim.
 */
export async function changeMarkers(a: {
  siteId: string;
  from: Date;
  to: Date;
}): Promise<ChangeMarker[]> {
  const scans = await measuredScans(a.siteId);
  const markers: ChangeMarker[] = [];

  for (let i = 1; i < scans.length; i += 1) {
    const previous = scans[i - 1]!;
    const current = scans[i]!;
    if (current.at < a.from || current.at > a.to) continue;

    if (current.domain !== previous.domain) {
      markers.push({ kind: "domain", on: current.at });
    }
    // A category that was never named on one side is not a change: the
    // question set was not re-derived from an answer nobody gave.
    if (
      current.category !== null &&
      previous.category !== null &&
      current.category !== previous.category
    ) {
      markers.push({ kind: "category", on: current.at });
    }
  }

  return markers;
}

/**
 * Every domain this site has been measured under, oldest first, with the
 * date it was first measured under it.
 *
 * REQ-071 c13: every number carries the domain it measured. This is the
 * table a surface reads that from, and it is derived rather than stored for
 * the same reason the markers are — the scan carries its own domain.
 */
export async function domainHistory(
  siteId: string
): Promise<{ domain: string; firstMeasuredAt: Date }[]> {
  const scans = await measuredScans(siteId);
  const history: { domain: string; firstMeasuredAt: Date }[] = [];
  for (const scan of scans) {
    if (history.at(-1)?.domain === scan.domain) continue;
    // A domain the site returns to after changing away is a new entry, not
    // the old one: the weeks between were measured under something else,
    // and joining them would be the movement across a change c13 forbids.
    history.push({ domain: scan.domain, firstMeasuredAt: scan.at });
  }
  return history;
}

/**
 * How many weeks this site has been measured for, counting from the first
 * measurement of the domain it holds now.
 *
 * REQ-071 c13's last sentence: "Any count of weeks the product states for
 * the site counts from the first measurement of the new domain." A count
 * spanning a domain change would be a number about two different sites.
 */
export async function weeksMeasured(siteId: string): Promise<number> {
  const scans = await measuredScans(siteId);
  const current = scans.at(-1);
  if (current === undefined) return 0;

  let count = 0;
  for (let i = scans.length - 1; i >= 0; i -= 1) {
    if (scans[i]!.domain !== current.domain) break;
    count += 1;
  }
  return count;
}
