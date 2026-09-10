// src/lib/scan/stuck.ts — §6.4's in-flight bound, and issue #438
//
// **The one row nobody is left holding.** A free pass runs inside the
// request that started it (§6.4: "Live mode only where a human is
// waiting"), and on a serverless deployment that request's invocation has
// a ceiling of its own — `maxDuration` on `src/app/api/scan/route.ts`,
// which is the platform's and not this product's. A pass that outlives it
// is frozen mid-flight: no ending is emitted, no report is stored, and the
// `scans` row admission claimed stays `running` for ever. That row is not
// merely untidy — `idx_scans_one_running_per_network` and
// `checkInFlight` in `./admission` both read `status = 'running'`, so a
// frozen pass refuses every later visitor from that network for a scan
// that will never finish. This module is the sweep that finishes it.
//
// **It holds no clock and no schedule.** `scansLeftRunning` takes `now`
// from its caller, so staleness is a pure function of a clock the module
// is handed and is testable at the boundary without travelling in time;
// the cadence is the maintenance tick's (`MAINTENANCE_TICK_MINUTES`), and
// it is not repeated here.
//
// **The threshold is the report ceiling, and not a second number.** A free
// pass is bounded by `TIMING.reportCeilingS` (ADR-021), and a pass that
// reaches that ceiling stores a report and leaves `running` in the same
// breath. So a free row still `running` longer than the ceiling has not
// been stopped by its own ceiling — nothing is going to stop it — and the
// only remaining question is which write lands first. Both orders are
// safe: `finishScanLeftRunning` updates only a row that is *still*
// `running`, so a pass storing its report at the boundary either beats the
// sweep (and the sweep finds nothing to write) or is beaten by it (and the
// stored report overwrites the failure with the truth).
//
// **Free rows only.** The bound this protects is the free path's in-flight
// bound, and the free tier is the only one that runs inside a request that
// can be frozen: a deep pass is released at ten minutes on the jobs queue
// and the weekly pass runs on the standard queue, neither of them holding
// a network's slot. A sweep that reached them would be finishing rows on a
// guess about a queue this module knows nothing about.
import { FREE_BOUNDS, TIMING } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

// ── The narrow, explicitly cast escape hatch ────────────────────────────
//
// `scans.stopped_reason` and `scans.finished_at` exist in the live schema
// (`supabase/migrations/00000000000005_scans_freepath.sql` and
// `20260904110000_scans_current.sql`) and are absent from the generated
// `Database` type, which was not regenerated with either migration — the
// same two gaps `./admission` and `./run` flag and work around the same
// way. Nothing else in this file bypasses the generated type.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  update(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  lt(column: string, value: string): MinimalQueryBuilder<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

/** Every free scan whose row is still `running` longer than a free pass
 *  can possibly be — the ceiling it bounds itself by, read from the pin
 *  rather than written twice.
 *
 *  Bounded by the day's own ceiling on free scans (`FREE_BOUNDS.scansPerDay`),
 *  which is the most rows one day of freezing could possibly have left
 *  behind: a due-work query that walked an unbounded table every tick
 *  would be the second defect this one is here to prevent. Oldest first,
 *  so the visitor who has been refused longest is unblocked first. */
export async function scansLeftRunning(now: Date): Promise<readonly string[]> {
  const before = new Date(now.getTime() - TIMING.reportCeilingS * 1000).toISOString();
  const { data, error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .select("id")
    .eq("tier", "free")
    .eq("status", "running")
    .lt("created_at", before)
    .order("created_at", { ascending: true })
    .limit(FREE_BOUNDS.scansPerDay);
  if (error) throw new Error(`scansLeftRunning: could not read the running rows: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

/** Finishes one such row: `failed`, with the reason the schema's own check
 *  constraint allows for a pass that produced no report (`failed` —
 *  `time_ceiling` and `spend_ceiling` are the two endings that *do* store
 *  one, and claiming either here would be reporting a report that does not
 *  exist), and a `finished_at` so the row is no longer in flight.
 *
 *  `eq("status", "running")` is the guard that makes the sweep safe
 *  against a pass finishing underneath it: a row that has since stored a
 *  report is not written, and the answer says so. Nothing else about the
 *  row is touched — the money the frozen pass did spend stays ledgered in
 *  `fetches`, which is the ledger (§6.5), and `cost_cents` is the stored
 *  report's field to write. */
export async function finishScanLeftRunning(scanId: string): Promise<{ finished: boolean }> {
  const { data, error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .update({
      status: "failed",
      stopped_reason: "failed",
      finished_at: new Date().toISOString(),
    })
    .eq("id", scanId)
    .eq("status", "running")
    .select("id");
  if (error) throw new Error(`finishScanLeftRunning: could not finish ${scanId}: ${error.message}`);
  const finished = (data ?? []).length > 0;
  console.log(JSON.stringify({ event: "scan_left_running_finished", scanId, finished }));
  return { finished };
}
