// The public report's read, for `/scan/{domain}` and its share image: a visit
// reads the current row's status and checksum, and the blob only when that
// checksum is new. The engine reads `readCurrentReport`, never this.
import { unstable_cache } from "next/cache";
import { readPastProtection } from "./challenged";
import { readStoredReport, REPORT_VERSION, type StoredReport } from "./report";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

// `is_current` and `report_md5` are not in the generated `Database` type.
interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

async function currentRow<T>(domain: string, columns: string): Promise<T | undefined> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await (dbAdmin() as unknown as { from<R>(table: string): MinimalQueryBuilder<R> })
    .from<T>("scans")
    .select(columns)
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`readShownReport: ${error.message}`);
  return data?.[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** What the report page renders of a blob: the re-score's kept copy only as
 *  the score its line names, so the cached item stays under 2 MB. */
function shownOf(blob: unknown): unknown {
  if (!isRecord(blob) || blob.previous === undefined) return blob;
  try {
    const scoreAndBand = readStoredReport(blob.previous).verdict.scoreAndBand;
    // Back to jsonb's shape: a cache miss hands this on before any round trip.
    return { ...blob, previous: JSON.parse(JSON.stringify({ version: REPORT_VERSION, verdict: { scoreAndBand } })) };
  } catch {
    return { ...blob, previous: undefined };
  }
}

async function shownBlob(domain: string): Promise<unknown> {
  const fresh = async () => shownOf((await currentRow<{ report: unknown }>(domain, "report"))?.report ?? null);
  const stamp = await currentRow<{ status: string; report_md5: string | null }>(domain, "status, report_md5");
  if (stamp === undefined) return null;
  // A running scan, or a row with no checksum to key on, is read fresh.
  if (stamp.status === "running" || typeof stamp.report_md5 !== "string") return fresh();
  // The key changes with the report, so no writer has to invalidate it.
  return unstable_cache(fresh, ["shown-report", domain, stamp.report_md5])();
}

/** The domain's current report as the public page shows it, or `null`. The
 *  protection ledger is read on every visit, outside the cache. */
export async function readShownReport(domain: string): Promise<StoredReport | null> {
  const blob = await shownBlob(domain);
  if (blob === null || blob === undefined) return null;
  return readPastProtection(readStoredReport(blob));
}
