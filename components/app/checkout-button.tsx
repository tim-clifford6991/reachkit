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

export function CheckoutButton({
  plan = "solo",
  children,
  pendingLabel = "Redirecting…",
  fallbackHref = "/app/billing",
  style,
  className,
}: {
  plan?: "solo" | "growth";
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
  /** Where to send the user when checkout can't start (default /app/billing). */
  fallbackHref?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const start = useCallback(async () => {
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !data.url) throw new Error("checkout failed");
      window.location.assign(data.url);
      // Keep the pending state — the browser is navigating away.
    } catch {
      // Error fallback: the billing page has the full plan cards + retry.
      window.location.assign(fallbackHref);
    }
  }, [plan, fallbackHref]);

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
