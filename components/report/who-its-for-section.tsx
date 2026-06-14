/**
 * WhoItsForSection — Q2: "Who it's for" (ICP signals).
 *
 * §5.6 four-question report: answers "Who is already buying this, and why?"
 * by surfacing ICP signals extracted from review and community data.
 *
 * Reusable: consumed by the funnel results page (moment 5) and the app
 * dashboard (Task 20, E3). Content-as-props — never fetches its own data.
 */

import type { ReportPayload } from "@/lib/scan/report";

interface WhoItsForSectionProps {
  whoItsFor: ReportPayload["whoItsFor"];
  /** When false (free tier), signals are limited to a preview count. */
  unlocked?: boolean;
  /** How many signal chips to show when locked (default 3). */
  previewSignalCount?: number;
}

export function WhoItsForSection({
  whoItsFor,
  unlocked = true,
  previewSignalCount = 3,
}: WhoItsForSectionProps) {
  const signals = unlocked
    ? whoItsFor.signals
    : whoItsFor.signals.slice(0, previewSignalCount);

  const hiddenCount = unlocked ? 0 : whoItsFor.signals.length - signals.length;

  return (
    <section
      aria-labelledby="who-its-for-heading"
      className="rounded-2xl border shadow-[var(--elevation-sm),var(--edge-highlight)]"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--gradient-surface)",
      }}
    >
      <div className="px-7 pb-6 pt-6">
        <div className="mb-4">
          <p
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            Question 2
          </p>
          <h2
            id="who-its-for-heading"
            className="mt-0.5 text-base font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            Who it&apos;s for
          </h2>
        </div>

        <div className="space-y-4">
          {/* Summary paragraph */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-fg)" }}>
            {whoItsFor.summary}
          </p>

          {/* ICP signal chips */}
          {signals.length > 0 && (
            <div>
              <p
                className="mb-2 font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Buyer signals
              </p>
              <div className="flex flex-wrap gap-2">
                {signals.map((sig) => (
                  <span
                    key={sig}
                    className="rounded-full border px-2.5 py-1 font-mono text-xs"
                    style={{
                      borderColor: "var(--color-accent-900)",
                      background: "var(--color-accent-subtle)",
                      color: "var(--color-accent-400)",
                    }}
                  >
                    {sig}
                  </span>
                ))}

                {/* Ghost chip indicating locked signals */}
                {hiddenCount > 0 && (
                  <span
                    className="rounded-full border px-2.5 py-1 font-mono text-xs"
                    style={{
                      borderColor: "var(--hairline)",
                      color: "var(--color-muted)",
                      background: "var(--fill-subtle)",
                    }}
                    aria-label={`${hiddenCount} more signals in your full report`}
                  >
                    +{hiddenCount} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
