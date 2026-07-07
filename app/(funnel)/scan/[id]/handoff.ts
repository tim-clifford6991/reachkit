export type ScanTier = "free" | "full";

/**
 * When should the live scan page (scan-stream) hand off to the same-url
 * inline report (<PublicReport>, rendered by ScanHydrator once
 * `report_payload` is persisted)?
 *
 * Both tracks now hand off on the SAME milestone — `reportReady` — regardless
 * of tier:
 *   • free used to hand off the instant findings landed, back when /results
 *     rendered a findings-only teaser straight from `findings_payload`. That
 *     route is gone: the inline render is <PublicReport>, which needs
 *     `report_payload`. Phase 1 now persists `report_payload` for BOTH tiers
 *     before the `done` event, so free scans reach `reportReady` too — handing
 *     off on findings alone just re-renders the same live view (no
 *     report_payload yet) and stalls on "Preparing your report…" forever.
 *   • full already waited for `reportReady` (the deep pass persists
 *     `report_payload` ~80s after findings); unchanged.
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
  return args.reportReady;
}
