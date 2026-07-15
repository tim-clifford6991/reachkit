"use client";

/**
 * CapturedUnlockButton — the results "Unlock full report" CTA, styled 1:1 with
 * the mockup's white button. Starts the anonymous paid checkout for the funnel
 * (Stripe → email → magic link). No free trial — the free scan is the only free
 * capability; unlocking the full report is a paid plan, charged immediately.
 *
 * This is the REAL rendered unlock surface on the live free report (wired in
 * via `unlockButton` from `app/(funnel)/scan/[id]/public-report.tsx`) — the
 * paywall-funnel events used to be wired to `TrialCta`, which has zero
 * usages, so the top of the paid funnel never fired in production. Moved
 * here (Task 1.4) so `paywallViewed`/`checkoutStarted` fire from the surface
 * that actually renders.
 *
 * The public report renders TWO of these per view (the ResultsScreen unlock
 * band + the closing "Close the gap" CTA card) — both mount, so without a
 * dedupe `paywall_viewed` would fire twice per view, silently halving the
 * true paywall→checkout conversion rate. `seenPaywallViews` is a module-level
 * (not per-instance) set so it survives across sibling mounts on the same
 * page load and fires the event exactly once per scanId.
 */

import { useState, useEffect } from "react";
import { funnel } from "@/lib/analytics";

const seenPaywallViews = new Set<string>();

/**
 * True the first time a given scanId is seen this page load, false on every
 * subsequent call (from a sibling instance or a re-mount) — the single gate
 * behind the once-per-view `paywall_viewed` dedupe. Exported as a pure
 * function (module-level Set as its only state) so the dedupe logic is
 * unit-testable without mounting React / running effects.
 */
export function markPaywallViewedOnce(scanId: string): boolean {
  if (seenPaywallViews.has(scanId)) return false;
  seenPaywallViews.add(scanId);
  return true;
}

export function CapturedUnlockButton({ scanId, plan = "solo" }: { scanId: string; plan?: "solo" | "growth" }) {
  const [loading, setLoading] = useState(false);

  // Funnel moment 4: the paywall is on screen. Fire once per scanId even
  // though multiple CapturedUnlockButton instances may mount for one view.
  useEffect(() => {
    if (markPaywallViewedOnce(scanId)) funnel.paywallViewed({ scan_id: scanId });
  }, [scanId]);

  async function start() {
    if (loading) return;
    setLoading(true);
    funnel.checkoutStarted({ plan, scan_id: scanId, source: "report" });
    try {
      const res = await fetch(`/api/scan/${scanId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && data.url) window.location.href = data.url;
      else setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={loading}
      style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 15, color: "var(--c-ink)", background: "var(--c-surface)", border: "none", borderRadius: 10, padding: "13px 24px", cursor: "pointer", whiteSpace: "nowrap", opacity: loading ? 0.7 : 1 }}
    >
      {loading ? "Starting…" : "Unlock the full report →"}
    </button>
  );
}
