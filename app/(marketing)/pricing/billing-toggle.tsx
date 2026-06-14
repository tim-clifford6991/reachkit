"use client";

/**
 * BillingToggle — the only client island on the pricing page.
 *
 * Holds the monthly/annual state and flips between two server-rendered card
 * grids passed in as props. Keeping the cards (TierCard) server-rendered keeps
 * the (marketing) First Load JS under budget — this component ships almost no JS.
 */

import { useState, type ReactNode } from "react";

interface BillingToggleProps {
  monthly: ReactNode;
  annual: ReactNode;
}

export function BillingToggle({ monthly, annual }: BillingToggleProps) {
  const [interval, setInterval] = useState<"month" | "year">("month");

  return (
    <div className="flex w-full flex-col items-center gap-10">
      {/* Toggle */}
      <div
        className="inline-flex items-center gap-1 rounded-full p-1"
        style={{ border: "1px solid var(--hairline)", background: "var(--fill-subtle)" }}
        role="group"
        aria-label="Billing interval"
      >
        {(["month", "year"] as const).map((opt) => {
          const active = interval === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setInterval(opt)}
              aria-pressed={active}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150"
              style={{
                background: active ? "var(--color-accent-600)" : "transparent",
                color: active ? "var(--color-accent-fg)" : "var(--color-muted)",
              }}
            >
              {opt === "month" ? "Monthly" : "Annual"}
              {opt === "year" && (
                <span
                  className="ml-1.5 font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: active ? "var(--color-accent-fg)" : "var(--color-accent-400)" }}
                >
                  −2 mo
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active card grid (both grids are server-rendered) */}
      {interval === "month" ? monthly : annual}

      <p className="text-center text-sm" style={{ color: "var(--color-muted)" }}>
        Every plan starts with a 7-day free trial. Your first scan is always free — no account
        needed.
      </p>
    </div>
  );
}
