/**
 * ScanContext — the shared per-scan context object, in a type-only module so it
 * can be imported without pulling in `pipeline.ts`'s runtime `collect` import.
 * `pipeline.ts` re-exports these for backward compatibility (existing importers
 * keep importing from `@/lib/scan/pipeline`); modules that would otherwise form
 * a cycle through `pipeline → collect → …` import straight from here
 * (e.g. `scan-competitors.ts`). Extracted 2026-07-21 (Phase S).
 */
import type { ScanBudget } from "@/lib/tools/registry";

export type ScanStage = "collect" | "extract" | "synth" | "critic" | "format";
export const SCAN_STAGES: ScanStage[] = ["collect", "extract", "synth", "critic", "format"];

export interface ScanContext {
  scanId: string;
  appId: string;
  storeUrl: string;
  mode: "ios" | "android" | "web";
  budget: ScanBudget;
  /**
   * The scan's tier. Optional with a SAFE default of "full" — an un-updated
   * caller never accidentally skips data. ONLY the public free path
   * (scan-requested) sets "free", which slims the collect step to the product
   * contract (R-1.5): a free scan gathers no reviews and no competitor
   * discovery (both off the free contract; competitors are re-collected at
   * deepen time — see runFullCollect). Phase S, 2026-07-21.
   */
  tier?: "free" | "full";
}
