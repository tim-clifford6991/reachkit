// The customer's own scan: the newest deep pass that stored a report. Overview
// reads it as week 0, and Overview and the Monday mail compare the month's
// figures with it.
import { dbAdmin } from "@/lib/db";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";

interface MinimalClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          not(column: string, operator: string, value: null): {
            order(column: string, options: { ascending: boolean }): {
              limit(n: number): PromiseLike<{ data: { report: unknown; created_at: string }[] | null; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };
}

/** The newest, not the first: a market re-measured by a second deep pass is
 *  shown the reading that stands. `undefined` where none is stored or the
 *  read fails. */
export async function readDeepReport(siteId: string): Promise<{ report: StoredReport; on: Date } | undefined> {
  const { data, error } = await (dbAdmin() as unknown as MinimalClient)
    .from("scans")
    .select("report, created_at")
    .eq("site_id", siteId)
    .eq("tier", "deep")
    .not("report", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (error !== null || row === undefined || row.report === null) return undefined;
  return { report: readStoredReport(row.report), on: new Date(row.created_at) };
}
