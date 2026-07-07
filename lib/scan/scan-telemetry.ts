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
import type { Json } from "@/lib/db/types";

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
