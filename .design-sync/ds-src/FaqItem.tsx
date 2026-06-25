import * as React from "react";

/** FaqItem — a bordered card with a bold question + a +/− indicator; when open, reveals the muted answer. Renders with no props. */
export interface FaqItemProps { question?: string; answer?: string; open?: boolean; }
export function FaqItem({ question = "How long does a scan take?", answer = "About 90 seconds. Paste your URL and you get a scored report with ranked fixes.", open = true }: FaqItemProps) {
  return (
    <div style={{ maxWidth: 560, boxSizing: "border-box", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-lg)", padding: open ? "18px 20px 20px" : "18px 20px", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--c-ink)", lineHeight: 1.35 }}>{question}</span>
        <span style={{ flex: "0 0 auto", width: 26, height: 26, borderRadius: "var(--radius-full)", background: "var(--c-soft)", color: "var(--c-action)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>{open ? "−" : "+"}</span>
      </div>
      {open ? <p style={{ margin: "12px 0 0", fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: "var(--c-muted)", maxWidth: "46ch" }}>{answer}</p> : null}
    </div>
  );
}
