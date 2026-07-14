"use client";

/**
 * CheckoutButton — one-click Stripe checkout for upgrade-intent CTAs (W6).
 *
 * POSTs /api/billing/checkout for the given plan (Solo by default) and redirects
 * straight to the returned Stripe URL — never to an intermediate page where the
 * user has to click "upgrade" again. While pending it disables and shows
 * `pendingLabel`. On ANY failure it falls back to navigating to /app/billing
 * (plan comparison + a retryable upgrade button live there), so the click always
 * lands somewhere useful.
 *
 * Headless about styling: each surface passes its own inline style so the CTA
 * keeps that surface's exact look (kit --c-* idiom stays with the caller).
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { funnel } from "@/lib/analytics";

export function CheckoutButton({
  plan = "solo",
  children,
  pendingLabel = "Redirecting…",
  fallbackHref = "/app/billing",
  onErrorToast,
  style,
  className,
}: {
  plan?: "solo" | "growth";
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  /** Where to send the user when checkout can't start (default /app/billing). */
  fallbackHref?: string;
  /** When set, a failed checkout shows this toast and STAYS put (retryable)
   *  instead of navigating to `fallbackHref` — so surfaces that want to be
   *  self-contained (e.g. Settings) never bounce the user to /app/billing. */
  onErrorToast?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const start = useCallback(async () => {
    setPending(true);
    funnel.checkoutStarted({ plan, source: "app" });
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Return the user to where they are now if they hit Back on Stripe.
        body: JSON.stringify({ plan, returnPath: window.location.pathname }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout failed");
      window.location.assign(data.url);
      // Keep the pending state — the browser is navigating away.
    } catch {
      if (onErrorToast) {
        toast.error(onErrorToast);
        setPending(false); // stay put, let the user retry
      } else {
        // Legacy fallback: the billing page has the full plan cards + retry.
        window.location.assign(fallbackHref);
      }
    }
  }, [plan, fallbackHref, onErrorToast]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void start()}
      className={className}
      style={{ cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, ...style }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
