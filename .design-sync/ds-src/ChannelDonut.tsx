import * as React from "react";

/**
 * ChannelDonut — "Traffic by channel" donut: an SVG ring split into channel
 * segments with a centred percent/label, plus a legend of channels with share
 * and visits. Colours come from the channel palette (`--c-tint-*`).
 */
export interface ChannelDonutProps {
  /** Ordered channel segments; `pct` are shares that sum to ~100. */
  segments: { label: string; pct: number; visits?: string; color?: string }[];
  /** Big centred label, e.g. "46% Organic". */
  centerLabel?: string;
  /** Diameter in px. */
  size?: number;
}

const PALETTE = [
  "var(--c-tint-violet)", "var(--c-tint-blue)", "var(--c-tint-green)",
  "var(--c-tint-amber)", "var(--c-tint-orange)", "var(--c-tint-red)",
];

export function ChannelDonut({ segments, centerLabel, size = 180 }: ChannelDonutProps) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", gap: 28, alignItems: "center", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-fill)" strokeWidth={16} />
        {segments.map((s, i) => {
          const len = (s.pct / 100) * C, off = (acc / 100) * C; acc += s.pct;
          return <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color || PALETTE[i % PALETTE.length]} strokeWidth={16}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
        })}
      </svg>
      <div>
        {centerLabel && <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{centerLabel}</div>}
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color || PALETTE[i % PALETTE.length] }} />
            <span style={{ color: "var(--c-ink)" }}>{s.label}</span>
            <span style={{ color: "var(--c-faint)", marginLeft: "auto" }}>{s.pct}%{s.visits ? ` · ${s.visits}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
