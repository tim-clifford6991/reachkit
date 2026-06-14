/**
 * EngagementStrip — streak + score-history sparkline for the dashboard.
 *
 * Server component. Sparkline is a tiny inline SVG (NOT recharts — no extra
 * bundle weight). Shows the weekly streak count and the score trend.
 * §7.3: streak counts consecutive weeks with >= 3 verified actions.
 */

import type { ScoreHistoryPoint } from "@/lib/scan/engagement";

interface EngagementStripProps {
  streak: number;
  history: ScoreHistoryPoint[];
  honestyNote: string | null;
}

// ---------------------------------------------------------------------------
// Inline sparkline SVG
// ---------------------------------------------------------------------------

interface SparklineProps {
  data: ScoreHistoryPoint[];
  width?: number;
  height?: number;
}

function Sparkline({ data, width = 120, height = 32 }: SparklineProps) {
  if (data.length < 2) {
    // Not enough data — show a flat baseline
    const y = height / 2;
    return (
      <svg width={width} height={height} aria-hidden viewBox={`0 0 ${width} ${height}`}>
        <line
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke="var(--hairline-strong)"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const values = data.map((d) => d.total);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1; // guard against flat series

  const pad = 2; // 2px padding top + bottom
  const innerH = height - pad * 2;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    // Invert: higher score = higher on canvas (lower y)
    const y = pad + innerH * (1 - (d.total - minV) / range);
    return { x, y, total: d.total };
  });

  // Build polyline points string
  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Fill area under the line
  const fillPath = [
    `M${points[0]?.x.toFixed(1) ?? 0},${height}`,
    ...points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length - 1]?.x.toFixed(1) ?? width},${height}`,
    "Z",
  ].join(" ");

  const lastPoint = points[points.length - 1];
  const isUp =
    (points[points.length - 1]?.total ?? 0) >= (points[0]?.total ?? 0);
  const lineColor = isUp ? "oklch(0.72 0.17 155)" : "oklch(0.78 0.18 70)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      role="img"
    >
      {/* Area fill */}
      <path
        d={fillPath}
        fill={`${lineColor.replace(")", " / 0.08)")}`}
      />
      {/* Line */}
      <polyline
        points={pointsStr}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last data point dot */}
      {lastPoint && (
        <circle
          cx={lastPoint.x.toFixed(1)}
          cy={lastPoint.y.toFixed(1)}
          r={2.5}
          fill={lineColor}
        />
      )}
    </svg>
  );
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
          background: "oklch(0.78 0.18 70 / 0.12)",
          border: "1.5px solid oklch(0.78 0.18 70 / 0.3)",
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

export function EngagementStrip({
  streak,
  history,
  honestyNote: _honestyNote,
}: EngagementStripProps) {
  const latestScore = history[history.length - 1]?.total ?? null;
  const firstScore = history[0]?.total ?? null;
  const totalDelta =
    latestScore !== null && firstScore !== null
      ? latestScore - firstScore
      : null;

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

        {/* Score trend */}
        {history.length > 0 && (
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <p
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--color-muted)" }}
              >
                Score trend
              </p>
              {totalDelta !== null && totalDelta !== 0 && (
                <p
                  className="font-mono text-sm tabular-nums"
                  style={{
                    color:
                      totalDelta > 0
                        ? "var(--color-success)"
                        : "var(--color-danger)",
                  }}
                >
                  {totalDelta > 0 ? "+" : ""}
                  {totalDelta} all time
                </p>
              )}
              {totalDelta === 0 && (
                <p
                  className="font-mono text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  Flat
                </p>
              )}
            </div>

            <Sparkline
              data={history}
              width={120}
              height={32}
            />
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
