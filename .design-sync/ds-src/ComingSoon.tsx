/* @mirrors components/sections/coming-soon.tsx */
import * as React from "react";

/**
 * ComingSoon — the shared centred placeholder the live `/roadmap` and `/status`
 * pages render: a mono eyebrow, a display H1, a blurb, and two buttons ("Scan
 * your product" / "Back to home"). Mirrors `components/sections/coming-soon.tsx`.
 */
export interface ComingSoonProps {
  eyebrow: string;
  title: string;
  blurb: string;
}

export function ComingSoon({ eyebrow, title, blurb }: ComingSoonProps) {
  return (
    <main aria-label={title} style={{ minHeight: "62vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "48px 28px" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--c-action)", margin: 0 }}>{eyebrow}</p>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(34px, 5vw, 46px)", letterSpacing: "-0.02em", color: "var(--c-ink)", margin: "14px 0 0" }}>{title}</h1>
      <p style={{ maxWidth: 448, fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", margin: "16px 0 0" }}>{blurb}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
        <a href="/scan" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-on-dark)", background: "var(--c-action)", border: "1px solid transparent", borderRadius: 10, padding: "11px 20px", textDecoration: "none" }}>Scan your product</a>
        <a href="/" style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 14, color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 10, padding: "11px 20px", textDecoration: "none" }}>Back to home</a>
      </div>
    </main>
  );
}
