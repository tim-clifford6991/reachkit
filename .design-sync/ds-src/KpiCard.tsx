/* @mirrors components/app/intel/kit.tsx */
import * as React from "react";

/**
 * KpiCard — a bordered dashboard metric tile: small uppercase label, a large
 * value, an optional delta chip (▲ green / ▼ red), and a muted sub-note. Renders
 * fully with no props.
 */
export interface KpiCardProps {
  label?: string;
  value?: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  note?: string;
  sub?: string;
}

export function KpiCard({ label = "Discoverability score", value = "46", delta, deltaDirection = "up", note = "vs. last scan", sub }: KpiCardProps) {
  const up = deltaDirection !== "down";
  const chipFg = up ? "var(--c-band-high)" : "var(--c-band-invisible)";
  const chipBg = up ? "var(--c-tint-green)" : "var(--c-tint-red)";
  return (
    <div style={{ boxSizing: "border-box", background: "var(--c-bg2)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-sm)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</span>
        {delta != null && delta !== "" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto", background: chipBg, color: chipFg, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, lineHeight: 1, padding: "3px 9px", borderRadius: "var(--radius-full)" }}>
            <span style={{ fontSize: 9 }}>{up ? "▲" : "▼"}</span>{delta}
          </span>
        )}
      </div>
      <b style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 23, color: "var(--c-ink)", lineHeight: 1 }}>{value}</b>
      {note != null && note !== "" && <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-muted)", marginTop: 2 }}>{note}</div>}
      {sub != null && sub !== "" && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--c-faint)" }}>{sub}</div>}
    </div>
  );
}
