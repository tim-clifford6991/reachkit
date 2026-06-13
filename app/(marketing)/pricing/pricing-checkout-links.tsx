"use client";

/**
 * PricingCheckoutLinks — client CTA button for the pricing page (Task 21a).
 *
 * Calls POST /api/billing/checkout → redirect to Stripe.
 * If the user is not authenticated (401 response), redirects to / so they
 * scan first (which triggers auth), then can return to upgrade.
 *
 * Native HTML only — keeps (marketing) bundle under 200 KB gzip budget.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface PricingCheckoutLinksProps {
  plan: "solo" | "growth";
  label: string;
  highlighted?: boolean;
}

export function PricingCheckoutLinks({
  plan,
  label,
  highlighted,
}: PricingCheckoutLinksProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        // Not authed — send them to scan first (auth happens during scan claim)
        window.location.href = "/";
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not start checkout — please try again.");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again.");
      setLoading(false);
    }
  }, [plan]);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      style={{
        display: "block",
        width: "100%",
        textAlign: "center",
        borderRadius: "0.5rem",
        border: highlighted ? "none" : "1px solid oklch(1 0 0 / 0.12)",
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        fontWeight: highlighted ? 600 : 500,
        color: highlighted ? "var(--color-accent-fg)" : "var(--color-fg)",
        background: highlighted
          ? "var(--color-accent-600)"
          : "oklch(1 0 0 / 0.04)",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "opacity 150ms",
        textDecoration: "none",
      }}
    >
      {loading ? "Redirecting…" : label}
    </button>
  );
}
