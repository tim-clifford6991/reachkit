/**
 * Sparkline — a tiny, dependency-free inline-SVG trend line.
 *
 * Extracted from engagement-strip's inline chart so every trend surface (score
 * history, market trends) shares one primitive. NOT recharts — no bundle weight,
 * matches the design system's inline-SVG convention.
 *
 * Prop-driven over a plain `number[]` (oldest-first). Colour defaults to
 * green-up / amber-down by comparing the last point to the first; pass `color`
 * to override. With < 2 points it renders a flat baseline.
 */

interface SparklineProps {
  /** Series values, oldest-first. */
  data: number[];
  width?: number;
  height?: number;
  /** Override the auto up/down colour (any CSS colour, incl. oklch(...)). */
  color?: string;
}

const UP_COLOR = "oklch(0.62 0.13 153)";
const DOWN_COLOR = "oklch(0.65 0.17 47)";

export function Sparkline({ data, width = 120, height = 32, color }: SparklineProps) {
  if (data.length < 2) {
    // Not enough data — show a flat baseline.
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

  const minV = Math.min(...data);
  const maxV = Math.max(...data);
  const range = maxV - minV || 1; // guard against a flat series

  const pad = 2; // 2px padding top + bottom
  const innerH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    // Invert: higher value = higher on canvas (lower y).
    const y = pad + innerH * (1 - (v - minV) / range);
    return { x, y };
  });

  const pointsStr = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Fill area under the line.
  const fillPath = [
    `M${points[0]?.x.toFixed(1) ?? 0},${height}`,
    ...points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${points[points.length - 1]?.x.toFixed(1) ?? width},${height}`,
    "Z",
  ].join(" ");

  const lastPoint = points[points.length - 1];
  const isUp = (data[data.length - 1] ?? 0) >= (data[0] ?? 0);
  const lineColor = color ?? (isUp ? UP_COLOR : DOWN_COLOR);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden role="img">
      {/* Area fill */}
      <path d={fillPath} fill={lineColor.replace(")", " / 0.08)")} />
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
        <circle cx={lastPoint.x.toFixed(1)} cy={lastPoint.y.toFixed(1)} r={2.5} fill={lineColor} />
      )}
    </svg>
  );
}
