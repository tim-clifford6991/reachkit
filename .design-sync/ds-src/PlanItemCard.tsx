import * as React from "react";

/**
 * PlanItemCard — a weekly action-plan item: title + type, the "why", a
 * provenance line ("from …"), predicted vs verified points, an optional
 * "Do this first" emphasis, and a status pill.
 */
export interface PlanItemCardProps {
  title: string;
  type?: string;
  why?: string;
  /** e.g. "+9 pts". */
  predictedPts?: string;
  /** verified points once shipped. */
  actualPts?: string;
  /** provenance, e.g. "Outreach gap vs fathom.video". */
  from?: string;
  shipNote?: string;
  doFirst?: boolean;
  status?: string;
  statusColor?: string;
}

export function PlanItemCard(p: PlanItemCardProps) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--c-ink)", border: `1px solid ${p.doFirst ? "var(--c-action)" : "var(--c-line)"}`, borderRadius: "var(--radius-lg)", padding: 16, background: "var(--c-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {p.doFirst && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--c-action)", textTransform: "uppercase", letterSpacing: ".04em" }}>Do this first</span>}
        {p.type && <span style={{ fontSize: 11, color: "var(--c-faint)", textTransform: "uppercase", letterSpacing: ".04em" }}>{p.type}</span>}
        {p.status && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "var(--c-on-dark)", background: p.statusColor || "var(--c-action)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>{p.status}</span>}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
      {p.why && <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 8 }}>{p.why}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--c-faint)" }}>
        {p.from && <span>from {p.from}</span>}
        {p.predictedPts && <span style={{ color: "var(--c-action)", fontFamily: "var(--font-mono)" }}>{p.predictedPts} predicted</span>}
        {p.actualPts && <span style={{ color: "var(--c-band-high)", fontFamily: "var(--font-mono)" }}>{p.actualPts} verified</span>}
      </div>
      {p.shipNote && <div style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--c-line)" }}>{p.shipNote}</div>}
    </div>
  );
}
