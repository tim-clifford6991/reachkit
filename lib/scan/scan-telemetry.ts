/**
 * Scan completion telemetry (launch-readiness B3).
 *
 * Live trustmrr.com shipped with `scans.cost_cents=0` (unit-economics blind) and
 * `score_snapshots=0` (dashboard history/trend chart starts empty). Both are
 * derived at completion:
 *  - `rollupScanCost` sums `pipeline_runs.cost_cents` onto the scan row;
 *  - `writeScanScoreSnapshot` drops one score-history point per completed pass so
 *    the timeline is alive from the first scan.
 *
 * Both are BEST-EFFORT — telemetry must never fail a completed scan.
 */

import { serverDb } from "@/lib/db/client";
import { scanCostCents } from "@/lib/telemetry/pipeline-runs";
import { newCostSink, runInCostContext, type CostSink } from "@/lib/scan/cost-context";
import type { Json } from "@/lib/db/types";

/** USD → cents, kept to 4 decimals so sub-cent DataForSEO calls don't round to 0. */
const toCents = (usd: number) => Math.round(usd * 100 * 1e4) / 1e4;

/**
 * Additively flush a step's accumulated external-API spend onto the scan row.
 * Called at the END of each cost-bearing Inngest step (inside the step, so it's
 * memoized with the step and replay-safe). Additive because a scan's spend
 * accrues across several steps (collect / findings / full-scan), each with its
 * own AsyncLocalStorage sink. Best-effort — telemetry must never fail a scan.
 *
 * Steps for one scan run sequentially, so the read-modify-write is race-free.
 */
export async function flushExternalCost(scanId: string, sink: CostSink): Promise<void> {
  const dfs = toCents(sink.dataforseo);
  const tavily = toCents(sink.tavily);
  if (dfs === 0 && tavily === 0) return;
  try {
    const db = serverDb();
    const { data } = await db
      .from("scans")
      .select("dataforseo_cost_cents, tavily_cost_cents")
      .eq("id", scanId)
      .maybeSingle();
    await db
      .from("scans")
      .update({
        dataforseo_cost_cents: Number(data?.dataforseo_cost_cents ?? 0) + dfs,
        tavily_cost_cents: Number(data?.tavily_cost_cents ?? 0) + tavily,
      })
      .eq("id", scanId);
  } catch (e) {
    console.error("[scan-telemetry] external cost flush failed (best-effort)", e);
  }
}

/**
 * Run an Inngest step body under a fresh external-API cost sink and flush its
 * delta to the scan row. Per-step + additive so it's replay-safe (a memoized step
 * doesn't re-run; a failed+retried step re-spends and re-adds — both correct).
 * `.finally` flushes even when the body throws, so pre-failure spend is recorded.
 */
export function costedStep<T>(scanId: string, fn: () => Promise<T>): Promise<T> {
  const sink = newCostSink();
  return runInCostContext(sink, fn).finally(() => flushExternalCost(scanId, sink));
}

/** Roll the scan's total pipeline cost onto `scans.cost_cents` (rounded cents). */
export async function rollupScanCost(scanId: string): Promise<number> {
  try {
    const total = await scanCostCents(scanId);
    const cents = Math.round(total);
    await serverDb().from("scans").update({ cost_cents: cents }).eq("id", scanId);
    return cents;
  } catch (e) {
    console.error("[scan-telemetry] cost rollup failed (best-effort)", e);
    return 0;
  }
}

/**
 * Write one score-history point at scan completion. `source` distinguishes the
 * free teaser point from the deep-pass point; the dashboard timeline renders both.
 */
export async function writeScanScoreSnapshot(args: {
  appId: string;
  scanId: string;
  total: number;
  breakdown: unknown;
  version: number;
  source: "scan" | "scan_deep";
}): Promise<void> {
  try {
    const { error } = await serverDb().from("score_snapshots").insert({
      app_id: args.appId,
      scan_id: args.scanId,
      total: args.total,
      breakdown: args.breakdown as Json,
      score_version: args.version,
      source: args.source,
    });
    if (error) throw error;
  } catch (e) {
    console.error("[scan-telemetry] score snapshot failed (best-effort)", e);
  }
}
