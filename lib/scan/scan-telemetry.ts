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
 * Which spend a flush represents:
 *  - "run"       — the scan's OWN pipeline passes (free + deep). Lands in BOTH the
 *                  lifetime columns AND the per-run columns.
 *  - "post-scan" — interactive intel gathers + the weekly-refresh cron, which flush
 *                  onto the app's *latest* scan row. Lands in the lifetime columns
 *                  ONLY, so it never inflates "what did this scan cost".
 * A mis-tag only skews the REPORTING split (run vs lifetime) — never the lifetime
 * accumulator, the cap (which reads lifetime), or money. `costedStep` defaults to
 * "run" (its 5 pipeline sites are the majority); the 2 refresh sites + every
 * `costedIntelStep` pass "post-scan" explicitly. Guard: `app/api/costed-routes.test.ts`.
 */
export type CostPhase = "run" | "post-scan";

/**
 * Additively flush a step's accumulated external-API spend onto the scan row.
 * Called at the END of each cost-bearing Inngest step (inside the step, so it's
 * memoized with the step and replay-safe). Additive because a scan's spend
 * accrues across several steps (collect / findings / full-scan), each with its
 * own AsyncLocalStorage sink. Best-effort — telemetry must never fail a scan.
 *
 * Steps for one scan run sequentially, so the read-modify-write is race-free.
 *
 * `phase` decides whether the delta also lands in the per-run columns (see
 * `CostPhase`). The lifetime columns and the cap-breach stamp are phase-agnostic.
 */
export async function flushExternalCost(scanId: string, sink: CostSink, phase: CostPhase = "run"): Promise<void> {
  const dfs = toCents(sink.dataforseo);
  const tavily = toCents(sink.tavily);
  if (dfs === 0 && tavily === 0 && !sink.breached) return;
  try {
    const db = serverDb();
    const { data } = await db
      .from("scans")
      .select("dataforseo_cost_cents, tavily_cost_cents, run_dataforseo_cost_cents, run_tavily_cost_cents, external_cap_hit_at")
      .eq("id", scanId)
      .maybeSingle();
    await db
      .from("scans")
      .update({
        // Lifetime accumulator — EVERY flush lands here ("what has this app cost
        // since?"). Unchanged; the soft cap reads it.
        dataforseo_cost_cents: Number(data?.dataforseo_cost_cents ?? 0) + dfs,
        tavily_cost_cents: Number(data?.tavily_cost_cents ?? 0) + tavily,
        // Per-run columns — only the scan's OWN pipeline passes ("what did this scan
        // cost?"). Post-scan intel/refresh flushes ("post-scan") skip these.
        ...(phase === "run"
          ? {
              run_dataforseo_cost_cents: Number(data?.run_dataforseo_cost_cents ?? 0) + dfs,
              run_tavily_cost_cents: Number(data?.run_tavily_cost_cents ?? 0) + tavily,
            }
          : {}),
        // Soft-cap stamp (invariant #2): first breach wins; visible on /app/diagnostics.
        ...(sink.breached && !data?.external_cap_hit_at
          ? { external_cap_hit_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", scanId);
  } catch (e) {
    console.error("[scan-telemetry] external cost flush failed (best-effort)", e);
  }
}

/** The scan's already-flushed external spend, in cents. Best-effort (0 on error). */
async function flushedExternalCents(scanId: string): Promise<number> {
  try {
    const { data } = await serverDb()
      .from("scans")
      .select("dataforseo_cost_cents, tavily_cost_cents")
      .eq("id", scanId)
      .maybeSingle();
    return Number(data?.dataforseo_cost_cents ?? 0) + Number(data?.tavily_cost_cents ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Run an Inngest step body under a fresh external-API cost sink and flush its
 * delta to the scan row. Per-step + additive so it's replay-safe (a memoized step
 * doesn't re-run; a failed+retried step re-spends and re-adds — both correct).
 * `.finally` flushes even when the body throws, so pre-failure spend is recorded.
 *
 * `capCents` (invariant #2 soft cap) is a PER-SCAN ceiling: the sink's headroom
 * is the cap minus what earlier steps already flushed onto the scan row, so the
 * cap holds cumulatively across steps. On breach the sink flips `breached`
 * (never throws); the pipeline's checkpoints (`externalCapBreached`) then skip
 * remaining external enrichment, and the scan row is stamped on flush.
 */
export async function costedStep<T>(
  scanId: string,
  fn: () => Promise<T>,
  opts: { capCents?: number; phase?: CostPhase } = {},
): Promise<T> {
  let capUsd: number | undefined;
  let preBreached = false;
  if (opts.capCents !== undefined) {
    const remaining = opts.capCents - (await flushedExternalCents(scanId));
    capUsd = Math.max(0, remaining) / 100;
    preBreached = remaining <= 0;
  }
  // scanId into the sink → LLM spend inside this step attributes via currentScanId().
  const sink = newCostSink(capUsd, scanId);
  if (preBreached) sink.breached = true;
  // Default "run": the 5 scan-pipeline sites are the majority. The 2 refresh sites
  // pass phase:"post-scan" so their recurring spend never inflates per-run cost.
  return runInCostContext(sink, fn).finally(() => flushExternalCost(scanId, sink, opts.phase ?? "run"));
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
