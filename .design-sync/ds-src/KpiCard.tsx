import * as React from "react";

/**
 * KpiCard — a bordered dashboard metric card: small uppercase label, a large
 * value, an optional delta chip (▲ green / ▼ red), and a muted sub-note. Renders
 * fully with no props.
 */
export interface KpiCardProps {
  label?: string;
  value?: string;
  delta?: string;
  deltaDirection?: "up" | "down";
  note?: string;
}

export function KpiCard({ label = "Discoverability score", value = "46", delta, deltaDirection = "up", note = "vs. last scan" }: KpiCardProps) {
  const up = deltaDirection !== "down";
  const chipFg = up ? "#1F9D5B" : "#E5484D";
  const chipBg = up ? "var(--c-tint-green)" : "var(--c-tint-red)";
  return (
    <div style={{ boxSizing: "border-box", maxWidth: 260, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: "18px 20px 16px", boxShadow: "rgba(20, 19, 26, 0.03) 0px 1px 2px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-faint)" }}>{label}</div>
        {delta != null && delta !== "" && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto", background: chipBg, color: chipFg, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, lineHeight: 1, padding: "4px 9px", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: 9.5 }}>{up ? "▲" : "▼"}</span>{delta}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--c-ink)", marginTop: 10 }}>{value}</div>
      {note != null && note !== "" && <div style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--c-muted)", marginTop: 6 }}>{note}</div>}
    </div>
  );
}
