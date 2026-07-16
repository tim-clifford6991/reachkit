/**
 * unlock-button.test.ts — IMPORTANT 2 regression: the public report renders
 * TWO CapturedUnlockButton instances per view (the ResultsScreen unlock band +
 * the closing "Close the gap" CTA), each running the `paywallViewed` mount
 * effect. Without a dedupe, `paywall_viewed` fires twice per view, silently
 * halving the true paywall→checkout conversion rate.
 *
 * `markPaywallViewedOnce` is the pure gate behind that effect (module-level
 * Set, no React needed to exercise it) — this proves it fires true exactly
 * once per scanId regardless of how many sibling instances call it, which is
 * exactly the two-instances-same-scanId shape on the real page.
 */
import { describe, it, expect } from "vitest";
import { markPaywallViewedOnce } from "./unlock-button";

describe("markPaywallViewedOnce", () => {
  it("returns true for the first call with a given scanId, false for every subsequent call — even from a different simulated instance", () => {
    const scanId = "scan-dedupe-1";
    // Simulates the ResultsScreen unlock-band instance mounting first...
    expect(markPaywallViewedOnce(scanId)).toBe(true);
    // ...then the "Close the gap" CTA instance mounting with the SAME scanId
    // (the real public-report.tsx shape) must NOT fire a second event.
    expect(markPaywallViewedOnce(scanId)).toBe(false);
    // A third mount (e.g. a re-render) still must not re-fire.
    expect(markPaywallViewedOnce(scanId)).toBe(false);
  });

  it("fires once per DISTINCT scanId (a different scan's report is a different view)", () => {
    expect(markPaywallViewedOnce("scan-dedupe-2")).toBe(true);
    expect(markPaywallViewedOnce("scan-dedupe-3")).toBe(true);
    expect(markPaywallViewedOnce("scan-dedupe-2")).toBe(false);
  });
});
