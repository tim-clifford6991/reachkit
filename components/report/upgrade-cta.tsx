"use client";

/**
 * UpgradeCta — §23 moment 7 upgrade prompt on the funnel report (Task 21a).
 *
 * Inserted at the E4 slot in /scan/[id]/results/page.tsx for free-tier viewers.
 * Paywall framed as activation — weekly deltas, action queue, verification.
 * No modal spam. Cancel-anytime stated plainly.
 *
 * Checkout: POST /api/billing/checkout { plan: "solo" } → window.location.
 * Unauthed users shouldn't see this (results page is public, but upgrade
 * requires auth — redirect to / if unauthenticated).
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";

interface UpgradeCtaProps {
  /** The scan id — kept for potential future analytics attribution. */
  scanId: string;
  /** Human-readable age of the report snapshot (e.g. "3 days ago"). */
  snapshotAge?: string;
}

export function UpgradeCta({ scanId: _scanId, snapshotAge }: UpgradeCtaProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "solo" }),
      });

      if (res.status === 401) {
        // Not authed — send them to scan (they'll auth there)
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
  }, []);

  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: "var(--color-accent-900)",
        background:
          "linear-gradient(135deg, oklch(0.70 0.13 66 / 0.07) 0%, var(--color-surface) 60%)",
      }}
      role="region"
      aria-label="Upgrade to unlock your action queue"
    >
      <div className="px-7 py-6">
        {/* Icon row */}
        <div
          className="mb-4 flex size-10 items-center justify-center rounded-full"
          style={{
            background: "var(--color-accent-subtle)",
            border: "1.5px solid var(--color-accent-900)",
          }}
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.5L9.5 5h4l-3.25 2.5 1.25 4L8 9 4.5 11.5l1.25-4L2.5 5h4L8 1.5z"
              stroke="var(--color-accent-400)"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p
          className="mb-1 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          Turn this into an engine
        </p>
        <h3
          className="mb-2 text-base font-semibold"
          style={{ color: "var(--color-fg)" }}
        >
          Weekly deltas. Action queue. Verification.
        </h3>
        <p
          className="mb-4 text-sm leading-relaxed"
          style={{ color: "var(--color-muted)" }}
        >
          {snapshotAge
            ? `Your report is a snapshot from ${snapshotAge} — and your competitors don't stand still. `
            : "Your report is a snapshot — and your competitors don't stand still. "}
          Solo turns it into a weekly system: a fresh action queue with draft
          copy, competitor moves detected automatically, and a score that moves
          as you ship.
        </p>

        {/* Value proof points */}
        <ul
          className="mb-4 space-y-2"
          aria-label="Solo plan includes"
        >
          {[
            "Fresh action queue every Monday — ranked, with draft copy",
            "New competitor moves detected automatically",
            "Score that moves as you execute — verified, not self-reported",
            "One-click verification when you ship a change",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm"
              style={{ color: "var(--color-fg)" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
                className="mt-0.5 shrink-0"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  stroke="var(--color-accent-500)"
                  strokeWidth="1.25"
                />
                <path
                  d="M4.5 7l1.75 1.75L9.5 5"
                  stroke="var(--color-accent-500)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {item}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleUpgrade()}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2"
          style={{
            background: "var(--color-accent-600)",
            color: "var(--color-accent-fg)",
          }}
        >
          {loading
            ? "Redirecting to checkout…"
            : "Activate Solo — $29/mo"}
        </button>

        <p
          className="mt-2 text-center font-mono text-[10px]"
          style={{ color: "var(--color-muted)" }}
        >
          Cancel any time. No lock-in.
        </p>
      </div>
    </div>
  );
}
