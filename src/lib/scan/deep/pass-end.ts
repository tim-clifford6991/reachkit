// SPEC §4 (2026-10-02, issue 1196) — how the founder's newest pass ended.
//
// The side panel names the running step while a pass runs
// (`./progress.ts`). When the pass ends it says how — done, failed with its
// reason, or stopped with its cause — for `REMEASURE.endShownMin`, rather
// than going blank. Read from the pass's own `scans` row: a deep pass is the
// onboarding pass or one measured again now; a weekly pass is its own tier
// and is never read here.
import { REMEASURE } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** How a finished pass ended, as the side panel states it. */
export type PassEnd = {
  outcome: "done" | "failed" | "stopped";
  /** `scans.stopped_reason`, or `null` where the row recorded none. */
  reason: string | null;
  /** When it ended. */
  at: string;
};

interface EndRow {
  status: string;
  stopped_reason: string | null;
  finished_at: string | null;
}

const STOPPED_REASONS: readonly string[] = ["time_ceiling", "spend_ceiling"];

/** A row's end, as one of the panel's three. */
export function passEndOf(row: EndRow): PassEnd | null {
  if (row.status === "running" || row.finished_at === null) return null;
  const reason = row.stopped_reason;
  const outcome =
    reason === "complete" ? "done" : reason !== null && STOPPED_REASONS.includes(reason) ? "stopped" : "failed";
  return { outcome, reason, at: row.finished_at };
}

/** The newest deep pass's end, where it ended inside
 *  `REMEASURE.endShownMin`; `null` where it is still running or ended
 *  longer ago than the panel speaks of. */
export async function recentPassEnd(siteId: string, now: Date = new Date()): Promise<PassEnd | null> {
  const { data, error } = await (dbAdmin() as unknown as MinimalClient)
    .from<EndRow>("scans")
    .select("status, stopped_reason, finished_at")
    .eq("site_id", siteId)
    .eq("tier", "deep")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`recentPassEnd: ${error.message}`);
  const row = data?.[0];
  if (row === undefined) return null;
  const end = passEndOf(row);
  if (end === null) return null;
  return now.getTime() - Date.parse(end.at) <= REMEASURE.endShownMin * 60_000 ? end : null;
}
