// The open report's background-reads status, read without the report blob:
// the page asks every few seconds, so each ask must cost one json path.
import { stillReading, type StoredReport } from "@/lib/scan/report";

/** Whether an open report still says it is reading searches: the scan is its
 *  domain's current, unremoved report and its marker is inside the window. */
export async function stillFinishing(scanId: string, now: Date): Promise<boolean> {
  const { dbAdmin } = await import("@/lib/db");
  const { isRemovedWith } = await import("@/lib/scan/removal");
  const { data, error } = await (dbAdmin() as unknown as ScansClient)
    .from("scans")
    .select("domain, finishing:report->finishingReads")
    .eq("id", scanId)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`stillFinishing: ${error.message}`);
  const row = data?.[0];
  if (!row || stillReading({ finishingReads: row.finishing }, now) === null) return false;
  return !(await isRemovedWith(dbAdmin(), row.domain));
}

interface ScansQuery extends PromiseLike<{ data: { domain: string; finishing: StoredReport["finishingReads"] }[] | null; error: { message: string } | null }> {
  select(columns: string): ScansQuery;
  eq(column: string, value: string): ScansQuery;
  is(column: string, value: boolean): ScansQuery;
  limit(n: number): ScansQuery;
}

interface ScansClient {
  from(table: "scans"): ScansQuery;
}
