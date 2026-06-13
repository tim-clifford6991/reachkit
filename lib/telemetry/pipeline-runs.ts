import { serverDb } from "@/lib/db/client";

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
