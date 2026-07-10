/* @mirrors components/app/intel/kit.tsx */
import * as React from "react";

/**
 * IntelKit — the shared in-app component set the intel views compose (Card,
 * Gauge, Bar, Badge, Eyebrow, Kpi/KpiRow, Donut, HeroCard). Mirrors
 * `components/app/intel/kit.tsx` so every app screen uses one consistent set of
 * primitives, tokens and band colours. Internal module — not its own card.
 */

const SG = "var(--font-display)", JM = "var(--font-mono)", PJ = "var(--font-sans)";

export const BANDS = [
  { min: 0, max: 29, label: "Invisible", color: "var(--c-band-invisible)" },
  { min: 30, max: 49, label: "Hard to find", color: "var(--c-band-hard)" },
  { min: 50, max: 69, label: "Fair", color: "var(--c-band-fair)" },
  { min: 70, max: 84, label: "Findable", color: "var(--c-band-findable)" },
  { min: 85, max: 100, label: "Highly discoverable", color: "var(--c-band-high)" },
];
export const bandFor = (score: number) => BANDS.find((b) => score >= b.min && score <= b.max) ?? BANDS[BANDS.length - 1];

const CARD: React.CSSProperties = { background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)", boxShadow: "0 1px 2px rgba(20,19,26,0.03)" };

const TINT: Record<string, { bg: string; fg: string }> = {
  violet: { bg: "var(--c-soft)", fg: "var(--c-action)" },
  neutral: { bg: "var(--c-fill)", fg: "var(--c-muted)" },
  green: { bg: "var(--c-tint-green)", fg: "var(--c-band-findable)" },
  amber: { bg: "var(--c-tint-amber)", fg: "var(--c-band-fair)" },
  red: { bg: "var(--c-tint-red)", fg: "var(--c-band-invisible)" },
  blue: { bg: "var(--c-tint-blue)", fg: "var(--c-action)" },
  orange: { bg: "var(--c-tint-orange)", fg: "var(--c-band-hard)" },
};

export function Badge({ tone = "neutral", children, style }: { tone?: keyof typeof TINT; children: React.ReactNode; style?: React.CSSProperties }) {
  const t = TINT[tone];
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: PJ, fontSize: 11.5, fontWeight: 600, borderRadius: 6, padding: "2px 8px", background: t.bg, color: t.fg, ...style }}>{children}</span>;
}

export function Eyebrow({ children, color = "var(--c-faint)" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: JM, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color }}>{children}</div>;
}

export function Card({ title, meta, info, children, style }: { title?: React.ReactNode; meta?: React.ReactNode; info?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ ...CARD, padding: 22, ...style }}>
      {(title || meta) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: SG, fontWeight: 700, fontSize: 15, color: "var(--c-ink)", margin: 0 }}>
            {title}
            {info && <span title={info} style={{ width: 15, height: 15, borderRadius: 999, border: "1px solid var(--c-line)", color: "var(--c-faint)", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "help" }}>i</span>}
          </h2>
          {meta && <div style={{ fontSize: 12, color: "var(--c-faint)" }}>{meta}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function HeroCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "linear-gradient(120deg, var(--c-tint-violet), var(--c-soft))", border: "1px solid var(--c-tint-violet-line)", borderRadius: "var(--radius-xl)", padding: 18, ...style }}>{children}</div>;
}

export function Bar({ value, max = 100, color = "var(--c-action)", height = 7 }: { value: number; max?: number; color?: string; height?: number }) {
  return <span style={{ display: "block", flex: 1, height, borderRadius: 5, background: "var(--c-fill)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 5 }} /></span>;
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>{children}</div>;
}

export function Kpi({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div style={{ ...CARD, borderRadius: "var(--radius-lg)", padding: 16 }}>
      <div style={{ fontFamily: JM, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--c-faint)" }}>{label}</div>
      <div style={{ fontFamily: JM, fontWeight: 700, fontSize: 30, color: color ?? "var(--c-ink)", margin: "6px 0 0" }}>{value}</div>
      {sub && <div style={{ fontFamily: PJ, fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// 270° dial (START 135°, SWEEP 270°) — the signature intel gauge.
export function Gauge({ score, sub, size = 184 }: { score: number; sub?: string; size?: number }) {
  const b = bandFor(score);
  const cx = size / 2, cy = size / 2, r = size / 2 - 14, START = 135, SWEEP = 270;
  const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`; };
  const arc = (frac: number) => { const end = START + SWEEP * frac; return `M ${pt(START)} A ${r} ${r} 0 ${SWEEP * frac > 180 ? 1 : 0} 1 ${pt(end)}`; };
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={arc(1)} fill="none" stroke="var(--c-fill)" strokeWidth="13" strokeLinecap="round" />
        <path d={arc(score / 100)} fill="none" stroke={b.color} strokeWidth="13" strokeLinecap="round" />
        <text x={cx} y={cy + 6} textAnchor="middle" style={{ font: `700 ${size * 0.2}px ${JM}, monospace`, fill: "var(--c-ink)" }}>{score}</text>
        <text x={cx} y={cy + size * 0.13} textAnchor="middle" style={{ font: `600 11px ${JM}, monospace`, fill: "var(--c-faint)" }}>/ 100</text>
      </svg>
      <div style={{ marginTop: -6 }}>
        <span style={{ display: "inline-block", fontFamily: SG, fontWeight: 700, fontSize: 12.5, padding: "4px 12px", borderRadius: 999, color: b.color, background: `color-mix(in oklab, ${b.color} 12%, transparent)` }}>{b.label}</span>
      </div>
      {sub && <div style={{ fontFamily: JM, fontSize: 10.5, color: "var(--c-faint)", marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

export function Donut({ segments, centerLabel, centerSub, size = 132, thickness = 16 }: { segments: { label: string; pct: number; color: string }[]; centerLabel?: string; centerSub?: string; size?: number; thickness?: number }) {
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-fill)" strokeWidth={thickness} />
        {segments.map((s) => { const dash = (s.pct / 100) * c; const el = <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-off} />; off += dash; return el; })}
        {centerLabel && <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" style={{ transform: "rotate(90deg)", transformOrigin: "center", font: `700 13px ${JM}, monospace`, fill: "var(--c-ink)" }}>{centerLabel}</text>}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {centerSub && <div style={{ fontFamily: JM, fontSize: 10.5, textTransform: "uppercase", color: "var(--c-faint)" }}>{centerSub}</div>}
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--c-muted)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} /> {s.label} <span style={{ fontFamily: JM, color: "var(--c-ink)", fontWeight: 600 }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
