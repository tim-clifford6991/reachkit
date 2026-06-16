"use client";

/**
 * TrialCta — the single trial wall for the payment-first funnel.
 *
 * Replaces the old email gate. Starts an anonymous Stripe checkout (Stripe →
 * Email → Magic Link); the account is created after payment. Two modes:
 *   - scan-first (scanId given): POST /api/scan/[id]/checkout — the scanned app
 *     lands in the new user's dashboard.
 *   - trial-direct (no scanId): POST /api/billing/trial — pricing-table path.
 *
 * Solo/Growth selectable; 7-day free trial, card collected at checkout.
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface TrialCtaProps {
  /** When present, the scanned app is linked to the new account (Path A). */
  scanId?: string;
  /** Compact rendering for inline use (e.g. inside the findings reveal). */
  className?: string;
}

const PLANS: Array<{ id: "solo" | "growth"; label: string; price: string; blurb: string }> = [
  { id: "solo", label: "Solo", price: "$59/mo", blurb: "1 app · weekly refresh" },
  { id: "growth", label: "Growth", price: "$129/mo", blurb: "3 apps · deeper tracking" },
];

export function TrialCta({ scanId, className }: TrialCtaProps) {
  const [plan, setPlan] = useState<"solo" | "growth">("solo");
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = scanId ? `/api/scan/${scanId}/checkout` : "/api/billing/trial";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(data.error ?? "Could not start your trial — please try again.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch {
      toast.error("Network error — please try again.");
      setLoading(false);
    }
  }, [plan, scanId]);

  return (
    <div className={className}>
      {/* Plan selector */}
      <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose a plan">
        {PLANS.map((p) => {
          const selected = plan === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(p.id)}
              className="rounded-lg border px-3 py-2.5 text-left transition-colors"
              style={{
                borderColor: selected ? "var(--color-accent-600)" : "var(--hairline)",
                background: selected ? "var(--color-accent-subtle)" : "var(--color-surface)",
              }}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--color-fg)" }}>
                  {p.label}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--color-accent-400)" }}>
                  {p.price}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--color-muted)" }}>
                {p.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void start()}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60"
        style={{ background: "var(--color-accent-600)", color: "var(--color-accent-fg)" }}
      >
        {loading ? "Redirecting to checkout…" : "Start 7-day free trial"}
      </button>
      <p className="mt-2 text-center font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
        Card collected now · first charge after 7 days · cancel in one click before day 7
      </p>
    </div>
  );
}
