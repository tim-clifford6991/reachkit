// BUILD §6.5, §11 — §11's stop, for one account, read once.
//
// **One home, because two surfaces state it.** ADR-011 point 6: a rule the
// product speaks has one implementation. The shell's own notice
// (`StoppedNotice`) and the calendar's stopped day (`empty.ts` through
// `stopped-account.ts`) are both statements about the same stop, and each
// reading `scans` for itself is how the two come to disagree about whether
// ReachKit stopped — one of them drawn from a run the other did not see.
// So the read lives here and both import it.
//
// It was `_shell/store.ts`'s private function until issue #113 gave the
// calendar the same fact to state; nothing about it changed in the move.
import { dbAdmin } from "@/lib/db";
import { stopCause, type WorkStop } from "@/lib/presentation/stopped";

interface LastScanRow {
  id: string;
  status: string;
  created_at: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The same narrow cast boundary `_shell/store.ts` documents: `scans`'
 *  columns are outside the generated `Database` type. */
function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface LastRun {
  status: "ok" | "degraded" | "failed";
  /** When that run happened, or `null` where this site has never run. */
  at: Date | null;
}

/** The last run this site made, as `stopCause` reads it, with the moment it
 *  happened — a stop that came from a run began when the run did, and that
 *  is a recorded fact rather than a guess. A site that has never run has
 *  nothing to report: `ok`, because no run has failed. */
async function lastRun(siteId: string): Promise<LastRun> {
  const { data, error } = await client()
    .from<LastScanRow>("scans")
    .select("id, status, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null || data === null) return { status: "ok", at: null };
  const row = data[0];
  if (row === undefined) return { status: "ok", at: null };
  const status = row.status === "degraded" ? "degraded" : row.status === "failed" ? "failed" : "ok";
  return { status, at: new Date(row.created_at) };
}

/**
 * §11's stop, for this account.
 *
 * `resumes` and `needs` are the two REQ-092 requires to be stated rather
 * than omitted. A kill switch promises no time (an operator lifts it, and
 * ReachKit does not know when) and needs nothing from the customer — it is
 * ReachKit's own stop, and REQ-092 c2's "when nothing is, says so" is what
 * the `nothing` arm renders.
 */
export async function readStop(siteId: string): Promise<WorkStop | null> {
  const { reachKitStopped } = await import("@/lib/publish/switch");
  const foundAt = new Date();
  const [killSwitch, run] = await Promise.all([reachKitStopped(), lastRun(siteId)]);
  const cause = stopCause({ capHit: false, killSwitch, lastRun: run.status });
  if (cause === null) return null;
  return {
    since: cause === "halted" ? foundAt : (run.at ?? foundAt),
    resumes: { promised: false },
    needs: { kind: "nothing" },
    // REQ-092 c6: a run that was cut short still produced its page, and the
    // day says part of the measurement behind it was not done.
    partial: run.status === "degraded",
  };
}

