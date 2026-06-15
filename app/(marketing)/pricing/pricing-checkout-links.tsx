"use client";

/**
 * PricingCheckoutLinks — client CTA button for the pricing page (Path B).
 *
 * Payment-first: POST /api/billing/trial → anonymous Stripe checkout (Stripe →
 * Email → Magic Link). No prior scan or login needed — the account is created
 * after payment and the user runs their first scan from the dashboard.
 *
 * Native HTML only — keeps (marketing) bundle under 200 KB gzip budget.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface PricingCheckoutLinksProps {
  plan: "solo" | "growth";
  label: string;
  highlighted?: boolean;
  /** Billing interval to check out with. Defaults to monthly. */
  interval?: "month" | "year";
}

export function PricingCheckoutLinks({
  plan,
  label,
  highlighted,
  interval = "month",
}: PricingCheckoutLinksProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });

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
  }, [plan, interval]);

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
        border: highlighted ? "none" : "1px solid var(--hairline-strong)",
        padding: "0.5rem 1rem",
        fontSize: "0.875rem",
        fontWeight: highlighted ? 600 : 500,
        color: highlighted ? "var(--color-accent-fg)" : "var(--color-fg)",
        background: highlighted
          ? "var(--color-accent-600)"
          : "var(--fill-subtle)",
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
