import { ScanBudget } from "@/lib/tools/registry";
import type { PreliminaryFacts } from "@/lib/scan/types";
import { collect } from "@/lib/scan/collect";

export type ScanStage = "collect" | "extract" | "synth" | "critic" | "format";
export const SCAN_STAGES: ScanStage[] = ["collect", "extract", "synth", "critic", "format"];

export interface ScanContext {
  scanId: string;
  appId: string;
  storeUrl: string;
  mode: "ios" | "android" | "web";
  budget: ScanBudget;
}

// Phase 1b implements collect(); 2 implements extract+synth; 3 implements critic+format.
export async function runCollect(ctx: ScanContext): Promise<PreliminaryFacts> {
  return collect(ctx);
}
