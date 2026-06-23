/**
 * WhatYouOfferSection — Q1: "What you offer" (positioning mirror).
 *
 * §5.6 four-question report: answers "What do you actually offer, in the
 * language your market uses?" by showing the gap between listing language
 * and what reviews actually value.
 *
 * Reusable: consumed by the funnel results page (moment 5) and the app
 * dashboard (Task 20, E3). Content-as-props — never fetches its own data.
 *
 * Animated version: when `animate` is true (moment 5 unlock), the section
 * uses blur-to-sharp. The results page wraps each section in a motion div.
 */

import type { ReportPayload } from "@/lib/scan/report";

interface WhatYouOfferSectionProps {
  whatYouOffer: ReportPayload["whatYouOffer"];
  /** If true, the full gap analysis is shown; otherwise a muted preview. */
  unlocked?: boolean;
}

export function WhatYouOfferSection({
  whatYouOffer,
  unlocked = true,
}: WhatYouOfferSectionProps) {
  const { positioningMirror: pm } = whatYouOffer;

  return (
    <section
      aria-labelledby="what-you-offer-heading"
      className="rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
      }}
    >
      <div className="px-7 pb-6 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--color-muted)" }}
            >
              Question 1
            </p>
            <h2
              id="what-you-offer-heading"
              className="mt-0.5 text-base font-semibold"
              style={{ color: "var(--color-fg)" }}
            >
              What you offer
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          {/* Two-column diff: what you claim vs what buyers actually value */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Positioning Mirror — intended (violet) vs actual (orange), per mockup */}
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: "var(--color-accent-subtle)",
                border: "1px solid var(--color-accent-900)",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--color-accent-400)" }}>
                Your listing says
              </p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
                {pm.listingSays}
              </p>
            </div>
            <div
              className="rounded-lg px-4 py-3"
              style={{
                background: "oklch(0.66 0.16 50 / 0.08)",
                border: "1px solid oklch(0.66 0.16 50 / 0.25)",
              }}
            >
              <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "oklch(0.58 0.15 50)" }}>
                Your page reads as
              </p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
                {pm.reviewsValue}
              </p>
            </div>
          </div>

          {/* Positioning gap — the key insight */}
          <div
            className="rounded-lg px-4 py-3"
            style={{
              background: unlocked
                ? "var(--color-danger-subtle)"
                : "var(--fill-subtle)",
              borderLeft: unlocked
                ? "2px solid var(--color-danger)"
                : "2px solid var(--hairline)",
            }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{
                color: unlocked
                  ? "oklch(0.70 0.20 22 / 0.85)"
                  : "var(--color-muted)",
              }}
            >
              Positioning gap
            </p>
            <p
              className="mt-1 text-sm leading-relaxed"
              style={{ color: "var(--color-fg)" }}
            >
              {pm.gap}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
