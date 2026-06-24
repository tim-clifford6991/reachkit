/**
 * EngagementStrip — streak + score-history sparkline for the dashboard.
 *
 * Server component. The trend chart is the shared inline-SVG `Sparkline`
 * primitive (NOT recharts — no extra bundle weight). Shows the weekly streak
 * count and the score trend. §7.3: streak counts consecutive weeks with >= 3
 * verified actions.
 */

import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import { Sparkline } from "@/components/ui/sparkline";

interface EngagementStripProps {
  streak: number;
  history: ScoreHistoryPoint[];
  honestyNote: string | null;
}

// ---------------------------------------------------------------------------
// Streak fire display
// ---------------------------------------------------------------------------

function StreakDisplay({ streak }: { streak: number }) {
  if (streak === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "oklch(0.66 0.16 50 / 0.12)",
          border: "1.5px solid oklch(0.66 0.16 50 / 0.3)",
        }}
      >
        <span aria-hidden className="text-base leading-none">
          {streak >= 4 ? "🔥" : streak >= 2 ? "✦" : "·"}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium tabular-nums" style={{ color: "var(--color-fg)" }}>
          {streak} week{streak === 1 ? "" : "s"}
        </p>
        <p className="font-mono text-[10px]" style={{ color: "var(--color-muted)" }}>
          streak
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Endowed-progress line — the retention hook. Leads with how far the score has
 * come ("+12 points since you started") so the dashboard opens on forward
 * momentum (Nunes & Drèze). Honest by design: flat and downward trends get their
 * own true framing rather than fabricated positivity.
 */
function ProgressLine({
  totalDelta,
  latestScore,
}: {
  totalDelta: number | null;
  latestScore: number | null;
}) {
  if (totalDelta === null) {
    // Only one snapshot so far — forward-looking, no trend to claim yet.
    return (
      <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
        {latestScore !== null
          ? `Score ${latestScore} — your trend builds from here`
          : "Tracking your score weekly"}
      </p>
    );
  }
  if (totalDelta > 0) {
    return (
      <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-success)" }}>
        +{totalDelta} point{totalDelta === 1 ? "" : "s"} since you started
      </p>
    );
  }
  if (totalDelta === 0) {
    return (
      <p className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
        Holding steady — your next plays move it
      </p>
    );
  }
  return (
    <p className="text-sm font-medium tabular-nums" style={{ color: "var(--color-fg)" }}>
      <span style={{ color: "var(--color-danger)" }}>
        {totalDelta} point{totalDelta === -1 ? "" : "s"}
      </span>{" "}
      — your next plays reverse it
    </p>
  );
}

export function EngagementStrip({
  streak,
  history,
  honestyNote,
}: EngagementStripProps) {
  const latestScore = history[history.length - 1]?.total ?? null;
  const firstScore = history[0]?.total ?? null;
  const totalDelta =
    latestScore !== null && firstScore !== null
      ? latestScore - firstScore
      : null;
  const weeksTracked = history.length;

  return (
    <section
      aria-label="Engagement summary"
      className="rounded-xl border"
      style={{
        borderColor: "var(--hairline)",
        background: "var(--color-surface)",
      }}
    >
      <div className="flex items-center gap-4 px-7 py-4">
        {/* Streak */}
        {streak > 0 && <StreakDisplay streak={streak} />}

        {/* Divider */}
        {streak > 0 && history.length > 0 && (
          <div
            className="h-8 w-px shrink-0"
            style={{ background: "var(--hairline)" }}
            aria-hidden
          />
        )}

        {/* Score progress — endowed-progress framing */}
        {history.length > 0 && (
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Your progress
              </p>
              <ProgressLine totalDelta={totalDelta} latestScore={latestScore} />
              {weeksTracked >= 2 && (
                <p
                  className="mt-0.5 font-mono text-[10px]"
                  style={{ color: "var(--color-muted)" }}
                >
                  across {weeksTracked} weekly check-ins
                </p>
              )}
              {honestyNote && (
                <p
                  className="mt-1 max-w-xs text-[11px] leading-snug"
                  style={{ color: "var(--color-muted)" }}
                >
                  {honestyNote}
                </p>
              )}
            </div>

            <Sparkline data={history.map((h) => h.total)} width={120} height={32} />
          </div>
        )}

        {/* No data state */}
        {streak === 0 && history.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Complete 3 plays this week to start your streak.
          </p>
        )}
      </div>
    </section>
  );
}
