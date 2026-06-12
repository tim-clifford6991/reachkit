import { ScanBudget } from "@/lib/tools/registry";

export type ScanStage = "collect" | "extract" | "synth" | "critic" | "format";
export const SCAN_STAGES: ScanStage[] = ["collect", "extract", "synth", "critic", "format"];

export interface ScanContext {
  scanId: string;
  appId: string;
  mode: "ios" | "android" | "web";
  budget: ScanBudget;
}

// Phase 1b implements collect(); 2 implements extract+synth; 3 implements critic+format.
export async function runCollect(_ctx: ScanContext): Promise<void> {
  /* Phase 1b */
}
