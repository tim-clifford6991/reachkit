/**
 * DonutChart — a dependency-free SVG donut with a center label + legend
 * (ChannelIntel UX). RSC-safe (no client boundary): static arcs via
 * stroke-dasharray, the same technique as the score ring.
 *
 * Generic over `segments`; used for share-of-voice (you vs rivals) but reusable.
 */

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const RIVAL_COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-1)"];
export const SELF_COLOR = "var(--color-accent-400)";

/** Helper: build SOV segments (self first, then rivals by share). */
export function sovSegments(
  selfPct: number,
  rivals: Array<{ domain: string; pct: number }>,
): DonutSegment[] {
  return [
    { label: "You", value: selfPct, color: SELF_COLOR },
    ...rivals.map((r, i) => ({ label: r.domain, value: r.pct, color: RIVAL_COLORS[i % RIVAL_COLORS.length]! })),
  ];
}

export function DonutChart({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  // Precompute each segment's fraction + cumulative start offset (no mutation
  // during render — keeps the component referentially clean).
  const fractions = segments.map((s) => s.value / total);
  const offsets = fractions.map((_, i) => -fractions.slice(0, i).reduce((a, b) => a + b, 0) * c);

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Share of voice">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--hairline)" strokeWidth={thickness} />
          {segments.map((seg, i) => {
            const f = fractions[i]!;
            if (f <= 0) return null;
            const dash = `${(f * c).toFixed(2)} ${(c - f * c).toFixed(2)}`;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={offsets[i]!.toFixed(2)}
              />
            );
          })}
        </g>
        {centerLabel && (
          <text x={cx} y={cx - 1} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.2} fontFamily="var(--font-mono)" fontWeight={600} fill="var(--color-fg)">
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x={cx} y={cx + size * 0.13} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.07} fontFamily="var(--font-mono)" fill="var(--color-muted)">
            {centerSub}
          </text>
        )}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: seg.color }} aria-hidden />
              <span className="min-w-0 truncate text-xs" style={{ color: "var(--color-fg)" }}>{seg.label}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: "var(--color-muted)" }}>
              {Math.round((seg.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
