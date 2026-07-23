"use client";

/**
 * LandingHydrate — wires interactivity onto the server-rendered captured
 * sections (landing `#rk-landing`, pricing `#rk-pricing`), which stay out of
 * the client bundle. Renders nothing.
 *
 * Every captured CTA that promises a scan is routed to a REAL scan entry: the
 * nearest live shared <ScanInput/> on the page when one exists (smooth-scroll +
 * focus — the actual POST /api/scan lives in that one component, never
 * duplicated here), otherwise the dedicated /scan page. Upgrade CTAs ("Start
 * Solo/Growth") open an ANONYMOUS Stripe checkout directly (L1, 2026-07-23) —
 * the pricing page used to bounce them to /login?next=/app/billing (a wall,
 * not a sell); the login route stays only as the graceful fallback.
 *
 * HISTORY (owner bug report 2026-07-16): the captured hero used to carry its
 * own <input>, and this file duplicated the scan POST against it. When the hero
 * became the React <ScanHero/> (outside the hydrate root), that input vanished
 * and every scan CTA in the captured HTML silently no-opped — and "Scan my
 * site" / "Get my score card" never even matched the wiring pattern. The
 * patterns are exported so captured-links.test.tsx can pin that every captured
 * <button> matches one — a new unwired CTA now fails the suite instead of
 * shipping dead.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Captured CTAs that must open a scan entry (a live input, or /scan). */
export const SCAN_CTA_PATTERN =
  /analyze my site|scan (your |my )?(site|product|app)|start.*scan|see your score|scan free|get started|score card|unlock/i;

/** Captured CTAs that must lead to a plan checkout (login → billing). */
export const UPGRADE_CTA_PATTERN = /start solo|start growth|upgrade/i;

/** Where upgrade CTAs land (login carries the user through to billing). */
export const UPGRADE_CTA_HREF = "/login?next=/app/billing";

/** Fallback scan entry when the page carries no live ScanInput. */
export const SCAN_FALLBACK_HREF = "/scan";

/**
 * The shared ScanInput's accessible name — how we find the live scan entries
 * on the page. Pinned against scan-input.tsx by captured-links.test.tsx.
 */
export const SCAN_INPUT_SELECTOR = 'input[aria-label="Website or product link"]';

export function LandingHydrate({ rootId = "rk-landing" }: { rootId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    /** Open an anonymous Stripe checkout for the chosen plan; on any failure
     *  fall back to the login→billing route so the CTA is never a dead click. */
    function openCheckout(plan: "solo" | "growth") {
      fetch("/api/billing/checkout/anonymous", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: "month" }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { url?: string }) => {
          if (d.url) window.location.href = d.url;
          else router.push(UPGRADE_CTA_HREF);
        })
        .catch(() => router.push(UPGRADE_CTA_HREF));
    }

    /** Scroll+focus the nearest live scan input; no input on page → /scan. */
    function openScanEntry(from: HTMLElement) {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(SCAN_INPUT_SELECTOR));
      if (inputs.length === 0) {
        router.push(SCAN_FALLBACK_HREF);
        return;
      }
      const y = from.getBoundingClientRect().top;
      const nearest = inputs.reduce((a, b) =>
        Math.abs(b.getBoundingClientRect().top - y) < Math.abs(a.getBoundingClientRect().top - y) ? b : a,
      );
      nearest.scrollIntoView({ behavior: "smooth", block: "center" });
      nearest.focus({ preventScroll: true });
    }

    const cleanups: Array<() => void> = [];
    root.querySelectorAll("button").forEach((b) => {
      const t = b.textContent?.trim() ?? "";
      // Upgrade first: "Start Solo/Growth" must never fall through to a scan.
      const h = UPGRADE_CTA_PATTERN.test(t)
        ? () => openCheckout(/growth/i.test(t) ? "growth" : "solo")
        : SCAN_CTA_PATTERN.test(t)
          ? () => openScanEntry(b)
          : null;
      if (h) {
        b.addEventListener("click", h);
        cleanups.push(() => b.removeEventListener("click", h));
      }
    });

    return () => cleanups.forEach((c) => c());
  }, [router, rootId]);

  return null;
}
