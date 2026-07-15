/**
 * Terminal status resolution for a scan whose Inngest pipeline function
 * failed after exhausting retries (launch-readiness Workstream C5).
 *
 * `scans.status` has a `'degraded'` value in its check constraint
 * (supabase/migrations/20260612085735_core_model.sql) that, before this fix,
 * was never actually written anywhere — every hard failure (scan-requested's
 * `onFailure`) unconditionally stamped `'failed'`, even when an earlier step
 * had already durably persisted a renderable `report_payload` (e.g. the
 * free-report/full-scan step succeeded and only a later step — the trailing
 * "done" step, or scan-deepen's "done" step — failed on a transient blip).
 *
 * That mattered because the public scan page's render gate is:
 *   `report_payload != null && status !== 'failed'`
 * (app/(funnel)/scan/[id]/page.tsx). Stamping `'failed'` over a scan that
 * already has a good partial report hid that report behind the "scan failed"
 * error UI — a launch scan that actually succeeded (with degraded content)
 * looked broken.
 *
 * `terminalStatusForFailure` / `handleScanPipelineFailure` centralize the fix:
 * degrade (keep the report reachable) whenever there is something to show,
 * and only fail outright when there truly is nothing.
 */

import { serverDb } from "@/lib/db/client";
import { emitScanEvent } from "@/lib/scan/progress";
import { captureServerException } from "@/lib/analytics-server";

/**
 * The terminal status to persist for a scan whose pipeline function is
 * giving up (retries exhausted). `'degraded'` when a `report_payload` was
 * already persisted by an earlier step (there's a renderable partial report
 * to preserve); `'failed'` when there is genuinely nothing to show — a
 * missing row or a lookup error is treated the same as "no report" so this
 * always resolves to a safe, non-throwing terminal status.
 */
export async function terminalStatusForFailure(
  scanId: string,
): Promise<"degraded" | "failed"> {
  const db = serverDb();
  const { data } = await db
    .from("scans")
    .select("report_payload")
    .eq("id", scanId)
    .maybeSingle();
  return data?.report_payload != null ? "degraded" : "failed";
}

/**
 * Shared `onFailure` body for the scan pipeline Inngest functions
 * (`scan-requested`, `scan-deepen`): emit the error scan_event for
 * observability, then degrade-or-fail the scan row per
 * `terminalStatusForFailure`. Never throws — an Inngest `onFailure` handler
 * running out of retries itself would just silently drop the terminal write.
 */
export async function handleScanPipelineFailure(
  scanId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await emitScanEvent(scanId, "error", { message });
  // Report the pipeline failure to error tracking (P4) — this is the biggest
  // prod blind spot: a scan that exhausts its Inngest retries fails in the
  // background where only Vercel raw logs would otherwise show it.
  await captureServerException(error, { source: "inngest:scan-pipeline", extra: { scanId } });
  const status = await terminalStatusForFailure(scanId);
  const { error: updateErr } = await serverDb()
    .from("scans")
    .update({ status })
    .eq("id", scanId);
  if (updateErr) {
    console.error(
      `[scan-pipeline-failure] failed to write terminal status=${status} for scan ${scanId}`,
      updateErr.message,
    );
  }
}
