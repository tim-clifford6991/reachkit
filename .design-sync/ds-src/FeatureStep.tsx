import * as React from "react";

/** FeatureStep — a "how it works" step: a violet number badge + display title + muted body. Renders with no props. */
export interface FeatureStepProps { step?: number; title?: string; body?: string; }
export function FeatureStep({ step = 1, title = "Paste your link", body = "Drop in your website or App Store URL — no signup, no setup." }: FeatureStepProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, maxWidth: 360, padding: 18, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", fontFamily: "var(--font-sans)" }}>
      <div style={{ flex: "0 0 auto", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-action)", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, lineHeight: 1 }}>{step}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 2 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--c-ink)", lineHeight: 1.3 }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--c-muted)", lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}
