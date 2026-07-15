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
 */

import { useState, useEffect } from "react";
import { funnel } from "@/lib/analytics";

export function CapturedUnlockButton({ scanId, plan = "solo" }: { scanId: string; plan?: "solo" | "growth" }) {
  const [loading, setLoading] = useState(false);

  // Funnel moment 4: the paywall is on screen.
  useEffect(() => {
    funnel.paywallViewed({ scan_id: scanId });
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
