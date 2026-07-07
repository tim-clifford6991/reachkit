/**
 * Two-track pipeline (M1) — deepen trigger.
 *
 * A free scan runs the cheap track only (collect + findings). `ensureDeepScan`
 * promotes such a scan to the deep (paid) pipeline: it flips `scans.tier` to
 * `'full'` and emits `scan/deepen`, which runs the heavy full-scan pass.
 *
 * Idempotent and safe to call from multiple places (checkout provisioning, a
 * paid viewer re-opening a free scan). Both the free/lightweight pass and the
 * deep pass now write a `report_payload`, so that column can no longer signal
 * "deep pass already ran". Instead we use `hasDeepReport`: only the deep pass
 * (`runFullScan`) persists rows to the `actions` table, so an actions row for
 * this scan is the reliable deep-pass sentinel.
 */

import { serverDb } from "@/lib/db/client";
import { inngest } from "@/lib/inngest/client";

/**
 * Has the DEEP pass already run for this scan? `runFullScan` stamps
 * `scans.deepened_at` when it completes — the unambiguous marker, set even when
 * the critic/floor leaves 0 actions. The `actions`-table check is kept as a
 * fallback for legacy scans deepened before the column existed. Fail-open
 * (returns false on a lookup error) so a transient blip never blocks a paid
 * upgrade.
 */
export async function hasDeepReport(scanId: string): Promise<boolean> {
  const db = serverDb();
  const { data, error } = await db
    .from("scans")
    .select("deepened_at")
    .eq("id", scanId)
    .maybeSingle();
  if (error) {
    console.error(`[deepen] deepened_at lookup failed for scan ${scanId}`, error.message);
    return false;
  }
  if (data?.deepened_at) return true;

  // Legacy fallback: scans deepened before `deepened_at` shipped still carry the
  // persisted action plan (runFullScan → persistActions), which the free/light
  // pass never writes.
  const { count, error: aErr } = await db
    .from("actions")
    .select("id", { count: "exact", head: true })
    .eq("scan_id", scanId);
  if (aErr) {
    console.error(`[deepen] actions fallback lookup failed for scan ${scanId}`, aErr.message);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Promote a free scan to the deep pipeline. Returns true when a deepen was
 * enqueued, false when it was unnecessary (already deep, or scan missing).
 */
export async function ensureDeepScan(scanId: string): Promise<boolean> {
  const db = serverDb();

  const { data: scan, error } = await db
    .from("scans")
    .select("id, tier")
    .eq("id", scanId)
    .maybeSingle();

  if (error) {
    console.error(`[deepen] lookup failed for scan ${scanId}`, error.message);
    return false;
  }
  if (!scan) return false;
  if (await hasDeepReport(scanId)) return false; // deep pass already ran

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
