export type ScanTier = "free" | "full";

/**
 * When should the live scan page (scan-stream) hand off to /scan/[id]/results?
 *
 * The two tracks END at different milestones:
 *   • free — stops after findings; /results renders the findings teaser straight
 *     from `findings_payload`. Hand off the instant findings land.
 *   • full — runs the deep pass (actions → critic → verified score → report),
 *     which persists `report_payload` ~80s AFTER findings. /results has no early
 *     render path, so handing off on findings drops the user on the
 *     "Finalising your action plan…" pending fallback for the whole deep pass.
 *     Wait for the report to actually be ready.
 *
 * Pure so it's unit-tested; the component just feeds it live state.
 */
export function shouldHandOffToResults(args: {
  tier: ScanTier;
  findingsReady: boolean;
  reportReady: boolean;
  failed: boolean;
}): boolean {
  // A failed run stays on the live page to show the error / partial result inline.
  if (args.failed) return false;
  return args.tier === "full" ? args.reportReady : args.findingsReady;
}
