/**
 * Two-track pipeline (M1) — deepen trigger.
 *
 * A free scan runs the cheap track only (collect + findings). `ensureDeepScan`
 * promotes such a scan to the deep (paid) pipeline: it flips `scans.tier` to
 * `'full'` and emits `scan/deepen`, which runs the heavy full-scan pass.
 *
 * Idempotent and safe to call from multiple places (checkout provisioning, a
 * paid viewer re-opening a free scan): if the scan already has a `report_payload`
 * the deep pass already ran, so it no-ops.
 */

import { serverDb } from "@/lib/db/client";
import { inngest } from "@/lib/inngest/client";

/**
 * Promote a free scan to the deep pipeline. Returns true when a deepen was
 * enqueued, false when it was unnecessary (already deep, or scan missing).
 */
export async function ensureDeepScan(scanId: string): Promise<boolean> {
  const db = serverDb();

  const { data: scan, error } = await db
    .from("scans")
    .select("id, tier, report_payload")
    .eq("id", scanId)
    .maybeSingle();

  if (error) {
    console.error(`[deepen] lookup failed for scan ${scanId}`, error.message);
    return false;
  }
  // Already deep (report produced) or missing → nothing to do.
  if (!scan || scan.report_payload) return false;

  if (scan.tier !== "full") {
    const { error: tierErr } = await db
      .from("scans")
      .update({ tier: "full" })
      .eq("id", scanId);
    if (tierErr) {
      console.error(`[deepen] failed to set tier=full for scan ${scanId}`, tierErr.message);
      return false;
    }
  }

  await inngest.send({ name: "scan/deepen", data: { scanId } });
  return true;
}
