/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";

/**
 * FinalCta — the landing's closing call to action: a centred "Stop guessing
 * where you stand." heading, a reassurance line, and the violet "Analyze my
 * site" button on a surface band. Mirrors the final section of the live landing
 * (`landing-html.ts`).
 */
export interface FinalCtaProps {
  _unused?: never;
}

export function FinalCta() {
  return (
    <section style={{ background: "var(--c-surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 8px" }}>Stop guessing where you stand.</h3>
        <p style={{ fontSize: 15, color: "var(--c-muted)", margin: "0 0 20px" }}>Your first scan is free and takes under a minute — then it&apos;s a number you can move, week after week.</p>
        <button style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, color: "var(--c-on-dark)", background: "var(--c-action)", border: "none", borderRadius: 10, padding: "12px 26px", cursor: "pointer" }}>Analyze my site</button>
      </div>
    </section>
  );
}
