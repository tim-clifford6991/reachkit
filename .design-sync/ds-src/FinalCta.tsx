/* @mirrors components/sections/captured/landing-final-cta.tsx */
import * as React from "react";
import { ScanInput } from "./ScanInput";

/**
 * FinalCta — the landing's closing call to action: a centred "Stop guessing
 * where you stand." heading, a reassurance line, and a REAL scan entry — the
 * shared ScanInput pill (field + violet "Analyze my site" button) — on a
 * surface band. Mirrors the live `landing-final-cta.tsx` (2026-07-16: the
 * captured decorative button was replaced by the working input so visitors
 * type their URL right there instead of scrolling back to the hero).
 */
export interface FinalCtaProps {
  _unused?: never;
}

export function FinalCta() {
  return (
    <section style={{ background: "var(--c-surface)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 8px", color: "var(--c-ink)" }}>Stop guessing where you stand.</h3>
        <p style={{ fontSize: 15, color: "var(--c-muted)", margin: "0 0 20px" }}>Your first scan is free and takes under a minute — then it&apos;s a number you can move, week after week.</p>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
          <ScanInput size="md" />
        </div>
      </div>
    </section>
  );
}
