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
    <section aria-labelledby="what-you-offer-heading">
      <div>
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
              className="mt-0.5 text-[20px] font-bold tracking-[-0.01em]"
              style={{ color: "var(--c-ink)", fontFamily: "var(--font-display)" }}
            >
              Positioning Mirror
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--c-faint)" }}>
              Who you think you target, vs. who your page actually reads as.
            </p>
          </div>
        </div>

        {/* White card — exact mockup styling (ReachKit.dc.html Positioning Mirror) */}
        <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 16, padding: 24 }}>
          <div className="grid gap-5 sm:grid-cols-2">
            {/* "You think you target" — violet column */}
            <div style={{ border: "1px solid #ECE7FB", background: "#FAF8FF", borderRadius: 12, padding: 18 }}>
              <div
                className="mb-3 text-xs font-bold uppercase"
                style={{ color: "var(--c-action)", letterSpacing: "0.04em" }}
              >
                You think you target
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className="text-[13px] font-semibold"
                  style={{ background: "var(--c-surface)", border: "1px solid #E2DEF0", color: "#3A3744", padding: "6px 12px", borderRadius: 8 }}
                >
                  {pm.listingSays}
                </span>
              </div>
            </div>
            {/* "Your page actually reads as" — orange column */}
            <div style={{ border: "1px solid #F0E4DA", background: "#FFFAF6", borderRadius: 12, padding: 18 }}>
              <div
                className="mb-3 text-xs font-bold uppercase"
                style={{ color: "#E0731C", letterSpacing: "0.04em" }}
              >
                Your page actually reads as
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className="text-[13px] font-semibold"
                  style={{ background: "var(--c-surface)", border: "1px solid #F0E0D2", color: "#3A3744", padding: "6px 12px", borderRadius: 8 }}
                >
                  {pm.reviewsValue}
                </span>
              </div>
            </div>
          </div>

          {/* Gap callout — red left border (mockup) */}
          <div
            style={{
              marginTop: 18,
              padding: "16px 18px",
              background: unlocked ? "#FDF6F6" : "var(--fill-subtle)",
              borderLeft: unlocked ? "3px solid #E5484D" : "3px solid var(--hairline)",
              borderRadius: "0 10px 10px 0",
              fontSize: "14.5px",
              lineHeight: 1.55,
              color: "#3A3744",
            }}
          >
            {pm.gap}
          </div>
        </div>
      </div>
    </section>
  );
}
