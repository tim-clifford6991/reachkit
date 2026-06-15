/**
 * UpgradeCta — the trial wall on the funnel report (§23 moment 7).
 *
 * Inserted on /scan/[id]/results for free viewers and used as the `#unlock`
 * scroll target for every locked deep section. Payment-first: the embedded
 * TrialCta starts an anonymous Stripe checkout (Stripe → Email → Magic Link),
 * carrying the scanId so the scanned app lands in the new dashboard.
 */

import { TrialCta } from "./trial-cta";

interface UpgradeCtaProps {
  /** The scan id — links the scanned app to the new account after checkout. */
  scanId: string;
  /** Human-readable age of the report snapshot (e.g. "3 days ago"). */
  snapshotAge?: string;
}

export function UpgradeCta({ scanId, snapshotAge }: UpgradeCtaProps) {
  return (
    <div
      id="unlock"
      className="scroll-mt-8 rounded-xl border"
      style={{
        borderColor: "var(--color-accent-900)",
        background:
          "linear-gradient(135deg, oklch(0.70 0.13 66 / 0.07) 0%, var(--color-surface) 60%)",
      }}
      role="region"
      aria-label="Start your free trial"
    >
      <div className="px-7 py-6">
        <p
          className="mb-1 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          Turn this into an engine
        </p>
        <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--color-fg)" }}>
          The full deep analysis — competitors, channels, creators, actions
        </h3>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {snapshotAge
            ? `Your report is a snapshot from ${snapshotAge} — and your competitors don't stand still. `
            : "Your report is a snapshot — and your competitors don't stand still. "}
          Start a free trial to unlock the full keyword & channel opportunities,
          every creator to reach, your strengths vs weaknesses, and a weekly
          action queue with draft copy — refreshed automatically.
        </p>

        <ul className="mb-5 space-y-2" aria-label="What you unlock">
          {[
            "Full keyword opportunities — volume, CPC & competition",
            "Every community & creator to reach, ranked",
            "What reviewers love vs hate — with the quotes",
            "A fresh, ranked action queue every week with draft copy",
          ].map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm"
              style={{ color: "var(--color-fg)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="mt-0.5 shrink-0">
                <circle cx="7" cy="7" r="6" stroke="var(--color-accent-500)" strokeWidth="1.25" />
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

        <TrialCta scanId={scanId} />
      </div>
    </div>
  );
}
