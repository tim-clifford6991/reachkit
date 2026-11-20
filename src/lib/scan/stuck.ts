// §6.4's in-flight bound: the sweep that finishes a free row nobody is left holding. A free pass runs inside its request's invocation, and one that
// outlives the platform's `maxDuration` is frozen with its row `running` for ever, refusing every later visitor from that network.
// It holds no clock and no schedule: `now` comes from the caller and the cadence is the maintenance tick's.
// The threshold is the platform's ceiling (`TIMING.platformCeilingS`) plus `TIMING.sweepMarginS`, never the design ceiling: a pass at the design
// ceiling is storing its partial report, not stuck. `finishScanLeftRunning` writes only a row still `running`, so a racing store wins either way.
// Free rows only: paid passes run on the jobs queue, hold no network's slot, and are not this module's to guess about.
import { FREE_BOUNDS, TIMING } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

// ── Cast escape hatch ─────────────────────────────────────────────────────
// `scans.stopped_reason` and `scans.finished_at` are absent from the generated `Database` type; nothing else here bypasses it.

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

/** How long a free row can stay `running` before the sweep calls it a ghost. Exported as the honest upper bound on how long a network is held,
 *  which the in-flight refusal's wait reads rather than restating. */
export const RUNNING_ROW_BOUND_S = TIMING.platformCeilingS + TIMING.sweepMarginS;

/** Every free scan still `running` longer than its invocation can exist (see above), oldest first so the longest-refused visitor is unblocked first.
 *  Bounded by `FREE_BOUNDS.scansPerDay`, the most rows one day could leave, so no tick walks an unbounded table. */
export async function scansLeftRunning(now: Date): Promise<readonly string[]> {
  const staleAfterMs = RUNNING_ROW_BOUND_S * 1000;
  const before = new Date(now.getTime() - staleAfterMs).toISOString();
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

/** Finishes one such row as `failed` (the ceiling endings store a report, and none exists) with a `finished_at`.
 *  `eq("status", "running")` keeps it safe against a pass finishing underneath. The spend stays ledgered in `fetches`; `cost_cents` is the report's to write. */
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
