import * as React from "react";

/**
 * ScanningRing — a 120px circular progress ring with a centred percent and a
 * status label (from the scanning screen). Renders the static filled state: a
 * faint track + a violet arc filled to `percent`. Renders fully with no props.
 */
export interface ScanningRingProps {
  percent?: number;
  label?: string;
}

export function ScanningRing({ percent = 64, label = "Analyzing your positioning…" }: ScanningRingProps) {
  const pct = Math.max(0, Math.min(100, percent));
  const size = 120, stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div style={{ width: "min(420px, 92vw)", textAlign: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ position: "relative", width: size, height: size, margin: "0 auto 18px" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-tint-violet-line)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-action)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 26, color: "var(--c-action)" }}>{Math.round(pct)}%</div>
      </div>
      <p style={{ fontSize: 15, color: "var(--c-muted)", margin: 0 }}>{label}</p>
    </div>
  );
}
