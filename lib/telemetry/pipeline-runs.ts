import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { emitScanEvent } from "@/lib/scan/progress";

// Per-MTok USD rates. PLACEHOLDER — confirm exact Haiku 4.5 / Sonnet 4.6 rates against the
// `claude-api` skill before launch. The cost MATH and model routing are what Cycle 0 locks; the
// precise numbers are tuned at launch and only affect the magnitude of logged cents, not structure.
export const MODEL_PRICES = {
  "claude-haiku-4-5-20251001": { inPerMTokUsd: 1.0, outPerMTokUsd: 5.0 },
  "claude-sonnet-4-6":         { inPerMTokUsd: 3.0, outPerMTokUsd: 15.0 },
} as const;
export type ModelId = keyof typeof MODEL_PRICES;

export function anthropicCostCents(model: ModelId, tokensIn: number, tokensOut: number): number {
  const p = MODEL_PRICES[model];
  return (tokensIn / 1e6) * p.inPerMTokUsd * 100 + (tokensOut / 1e6) * p.outPerMTokUsd * 100;
}

export type PipelineRun = {
  // scanId is intentionally NULLABLE: most runs belong to a scan, but the budgeted fleet-wide jobs
  // (§5.7 scheduled shared-cache refresh, cross-customer DataForSEO refresh) are telemetry-worthy yet
  // not tied to any single scan. Those log with scanId=null. Per-scan budget caps aggregate by scanId.
  scanId: string | null;
  // "refresh" is the Cycle 4 weekly delta-refresh aggregate row (one per run): it
  // rolls up the whole watermark→Haiku→novelty→Sonnet pass under a single stage so
  // the cheap no-op weeks (costCents:0) and the rare escalation weeks are both
  // visible in pipeline_runs without double-counting the per-call rows callModel
  // already writes.
  stage: "collect" | "extract" | "synth" | "critic" | "format" | "tool" | "refresh";
  model?: ModelId; tokensIn?: number; tokensOut?: number;
  costCents: number; criticRejections?: number; durationMs: number;
};

export async function recordPipelineRun(run: PipelineRun): Promise<void> {
  const db = serverDb();
  const { error } = await db.from("pipeline_runs").insert({
    scan_id: run.scanId, stage: run.stage, model: run.model ?? null,
    tokens_in: run.tokensIn ?? 0, tokens_out: run.tokensOut ?? 0,
    cost_cents: run.costCents, critic_rejections: run.criticRejections ?? 0, duration_ms: run.durationMs,
  });
  if (error) throw error;
}

export async function scanCostCents(scanId: string): Promise<number> {
  const db = serverDb();
  const { data } = await db.from("pipeline_runs").select("cost_cents").eq("scan_id", scanId);
  return (data ?? []).reduce((n, r) => n + Number(r.cost_cents), 0);
}

// §13 cost-overrun alert: a scan whose total pipeline cost runs hot (spec target:
// p95 > $1.50) emits a telemetry marker so we can spot per-scan cost regressions
// in the logs. This does NOT throw — the §9.5 hard ceiling (ScanBudget) is what
// actually stops a runaway scan; by the time the report is persisted the spend is
// already incurred, so the alert is observe-only and must never break the scan.
// Returns the scan's total cost in cents.
export async function checkScanCostOverrun(scanId: string, thresholdCents = 150): Promise<number> {
  const total = await scanCostCents(scanId);
  if (total > thresholdCents) {
    console.error(
      `[cost-alert] scan ${scanId} exceeded budget: ${total}¢ > ${thresholdCents}¢`,
    );
  }
  return total;
}

/**
 * Persist a `cost-alert` scan event (deduped: one per scan+scope) so alerts
 * survive past the log window and surface on /app/diagnostics. Best-effort.
 */
async function persistCostAlert(
  scanId: string,
  scope: "scan" | "user-daily",
  cents: number,
  thresholdCents: number,
): Promise<void> {
  try {
    const db = serverDb();
    const { data: existing } = await db
      .from("scan_events")
      .select("id, payload")
      .eq("scan_id", scanId)
      .eq("type", "cost-alert")
      .limit(50);
    if ((existing ?? []).some((e) => (e.payload as { scope?: string } | null)?.scope === scope)) return;
    await emitScanEvent(scanId, "cost-alert", { scope, cents, thresholdCents });
  } catch (e) {
    console.error("[cost-alert] persist failed (best-effort)", e);
  }
}

/**
 * ALL-IN per-scan cost alert (LLM + DataForSEO + Tavily — the number that
 * actually hits the bill, unlike `checkScanCostOverrun` which is LLM-only).
 * Observe-only: console + a persisted `cost-alert` event; never breaks a scan.
 * Returns the all-in total in cents.
 */
export async function checkAllInCostOverrun(scanId: string): Promise<number> {
  try {
    const { data } = await serverDb()
      .from("scans")
      .select("cost_cents, dataforseo_cost_cents, tavily_cost_cents")
      .eq("id", scanId)
      .maybeSingle();
    const total =
      Number(data?.cost_cents ?? 0) +
      Number(data?.dataforseo_cost_cents ?? 0) +
      Number(data?.tavily_cost_cents ?? 0);
    if (total > env.costAlertScanCents) {
      console.error(`[cost-alert] scan ${scanId} all-in cost ${Math.round(total)}¢ > ${env.costAlertScanCents}¢`);
      await persistCostAlert(scanId, "scan", Math.round(total), env.costAlertScanCents);
    }
    return total;
  } catch (e) {
    console.error("[cost-alert] all-in check failed (best-effort)", e);
    return 0;
  }
}

/**
 * Per-user DAILY all-in alert: sums the last 24h of scans across every app the
 * owning user has. Anchored on the scan that triggered the check (its app →
 * owning user via users.app_ids). Observe-only, deduped per scan.
 */
export async function checkUserDailyCostOverrun(scanId: string): Promise<void> {
  try {
    const db = serverDb();
    const { data: scanRow } = await db.from("scans").select("app_id").eq("id", scanId).maybeSingle();
    if (!scanRow?.app_id) return;
    const { data: owner } = await db
      .from("users")
      .select("id, app_ids")
      .contains("app_ids", [scanRow.app_id])
      .limit(1)
      .maybeSingle();
    const appIds = (owner?.app_ids ?? []) as string[];
    if (!owner || appIds.length === 0) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: scans } = await db
      .from("scans")
      .select("cost_cents, dataforseo_cost_cents, tavily_cost_cents")
      .in("app_id", appIds)
      .gte("started_at", since);
    const total = (scans ?? []).reduce(
      (n, s) => n + Number(s.cost_cents ?? 0) + Number(s.dataforseo_cost_cents ?? 0) + Number(s.tavily_cost_cents ?? 0),
      0,
    );
    if (total > env.costAlertUserDailyCents) {
      console.error(
        `[cost-alert] user ${owner.id} 24h all-in cost ${Math.round(total)}¢ > ${env.costAlertUserDailyCents}¢`,
      );
      await persistCostAlert(scanId, "user-daily", Math.round(total), env.costAlertUserDailyCents);
    }
  } catch (e) {
    console.error("[cost-alert] user-daily check failed (best-effort)", e);
  }
}
