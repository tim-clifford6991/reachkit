/**
 * The ONE home for a scan's per-step external soft-cap policy (DataForSEO +
 * Tavily). Kept as a thin, env-only module so it can be unit-tested in isolation
 * without dragging in the whole scan pipeline (scan-requested.ts imports
 * runCollect/runFullScan/…, which access env at import — a guard importing THAT
 * would trip env validation before it could set up).
 *
 * Invariant #2 (degrade, never throw): these are the ceilings at which
 * `recordExternalCost` flips `externalCapBreached` — they never abort a call.
 */
import { env } from "@/lib/config/env";

export type ScanTier = "free" | "full";
export type ScanStep = "collect" | "findings" | "free-report" | "full-scan";

/** External DFS+Tavily soft cap for the tier. */
export function externalCapCentsForTier(tier: ScanTier): number {
  return tier === "full" ? env.externalScanCapCentsFull : env.externalScanCapCentsFree;
}

/**
 * The external soft-cap ceiling (cents) for a pipeline step at a given tier.
 * EVERY step derives its cap from the TIER — no step hard-codes the full 150¢
 * ceiling for a free scan. That hole (collect hard-coded `externalScanCapCentsFull`
 * regardless of tier) let a "free" scan overspend its 25¢ ceiling in collect,
 * where competitor discovery + Tavily/DFS + an LLM all run (2026-07-18).
 * `full-scan` is the one full-ONLY step, so its ceiling is the full cap by
 * definition (it never runs for a free scan). Guard: lib/scan/scan-caps.test.ts
 * (mutation-proven).
 */
export function externalCapCentsFor(step: ScanStep, tier: ScanTier): number {
  if (step === "full-scan") return env.externalScanCapCentsFull; // full-only step
  return externalCapCentsForTier(tier);
}
