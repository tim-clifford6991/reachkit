/**
 * UpgradeCta — the trial wall on the funnel report (§23 moment 7).
 *
 * Inserted on /scan/[id]/results for free viewers and used as the `#unlock`
 * scroll target for every locked deep section. Payment-first: the embedded
 * TrialCta starts an anonymous Stripe checkout (Stripe → Email → Magic Link),
 * carrying the scanId so the scanned app lands in the new dashboard.
 */

import { TrialCta } from "./trial-cta";
import type { LossFrame } from "@/lib/scan/competitive-framing";

interface UpgradeCtaProps {
  /** The scan id — links the scanned app to the new account after checkout. */
  scanId: string;
  /** Human-readable age of the report snapshot (e.g. "3 days ago"). */
  snapshotAge?: string;
  /** Named competitive gap — when present, the CTA leads with the diagnosis. */
  lossFrame?: LossFrame | null;
}

export function UpgradeCta({ scanId, snapshotAge, lossFrame }: UpgradeCtaProps) {
  // Diagnosis → cure → treatment. Lead with the named loss when we have one.
  const diagnosis = lossFrame
    ? lossFrame.behindCount > 1
      ? `${lossFrame.leaderName} and ${lossFrame.behindCount - 1} other rival${
          lossFrame.behindCount - 1 === 1 ? "" : "s"
        } are out-talking you where your buyers gather. `
      : `${lossFrame.leaderName} is out-talking you where your buyers gather. `
    : "Your competitors are winning attention you can't see yet. ";
  const headline = lossFrame
    ? `Take back the ground you're losing to ${lossFrame.leaderName}`
    : "Turn this scan into an engine that wins your buyers back";

  return (
    <div
      id="unlock"
      className="scroll-mt-8 rounded-xl border"
      style={{
        borderColor: "var(--color-accent-900)",
        background:
          "linear-gradient(135deg, oklch(0.56 0.205 285 / 0.07) 0%, var(--color-surface) 60%)",
      }}
      role="region"
      aria-label="Unlock the full report"
    >
      <div className="px-7 py-6">
        <p
          className="mb-1 font-mono text-[10px] uppercase tracking-widest"
          style={{ color: "var(--color-accent-400)" }}
        >
          Fix the gap · then never fall behind
        </p>
        <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--color-fg)" }}>
          {headline}
        </h3>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {diagnosis}
          Unlock the full report to see your exact opening vs every rival, the
          creators who already reach their buyers, and a weekly action queue with
          draft copy. Then we re-scan
          {snapshotAge ? ` this ${snapshotAge} snapshot` : ""} every week and alert
          you the moment a competitor moves.
        </p>

        <ul className="mb-5 space-y-2" aria-label="What you unlock">
          {[
            "The full Ease×Impact×Competition playbook — ranked moves, each with its evidence",
            "You vs every rival: benchmark, share-of-voice, channel matrix + the keyword gap",
            "Your top organic pages, rivals' marketplace presence, and recent buzz in your space",
            "Weekly alerts + market trends the moment a competitor moves — plus one-click CSV export",
            "Every action with ready-to-send draft copy, refreshed automatically each week",
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
