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
// next tick offers the week again. A row still `running` is not read; if it
// finishes too small after the digest went, the next tick sends it alone.
import { dbAdmin } from "@/lib/db";
import { marketTooSmall } from "../market-floor";
import { readStoredReport } from "../report";

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
  neq(column: string, value: string): MinimalQueryBuilder<T>;
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

/** Monday 00:00 → Tuesday 12:00 UTC: the moment Monday has ended in UTC−12. */
const MONDAY_ENDS_EVERYWHERE_MS = 36 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The latest Monday, as `YYYY-MM-DD`, that has ended in every zone. */
export function lastEndedMonday(now: Date): string {
  const t = new Date(now.getTime() - MONDAY_ENDS_EVERYWHERE_MS);
  const sinceMonday = (t.getUTCDay() + 6) % 7;
  return new Date(t.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** Unread, finished weekly rows of one week. */
function unread(columns: string, weekStart: string): MinimalQueryBuilder<DigestRow> {
  return untyped()
    .from<DigestRow>("scans")
    .select(columns)
    .eq("tier", "weekly")
    .eq("week_start", weekStart)
    .neq("status", "running")
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
 * that found too little market, and stamps every row it read. Answers
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
      if (marketTooSmall(readStoredReport(row.report).questions)) tooSmall.push(row.id);
    } catch {
      // A report this build cannot read is not a market this digest can judge.
      console.warn(JSON.stringify({ event: "market_digest_unreadable_report", scanId: row.id }));
    }
  }

  if (tooSmall.length > 0) {
    const { reportIncident } = await import("@/lib/mail/ops");
    const accepted = await reportIncident({ occasion: "market-too-small-week", weekStart, scanIds: tooSmall });
    if (!accepted) return false;
  }

  const ids = rows.map((row) => row.id);
  const stamped = await untyped()
    .from<DigestRow>("scans")
    .update({ market_digest_at: now.toISOString() })
    .in("id", ids)
    .is("market_digest_at", null);
  if (stamped.error) throw new Error(`sendMarketDigest: could not stamp the week: ${stamped.error.message}`);
  console.log(JSON.stringify({ event: "market_digest", weekStart, read: ids.length, tooSmall: tooSmall.length }));
  return true;
}
