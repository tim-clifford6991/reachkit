import * as React from "react";
import { ScanInput } from "./ScanInput";

/**
 * LandingHero — the marketing hero: an eyebrow, a big display headline (with a
 * violet-accented phrase), a supporting subhead, and the ScanInput conversion
 * control. Renders fully with no props.
 */
export interface LandingHeroProps {
  eyebrow?: string;
  headline?: string;
  accent?: string;
  subhead?: string;
}

export function LandingHero({
  eyebrow = "The discoverability engine for solo founders",
  headline = "Stop guessing why your product",
  accent = "isn't getting found.",
  subhead = "Paste your site or App Store link and get a scored discoverability report — SEO gaps, positioning blind spots, and the ranked fixes that move the needle — in ~90 seconds.",
}: LandingHeroProps) {
  return (
    <section style={{ background: "var(--c-bg)", padding: "72px 24px", textAlign: "center", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--c-soft)", color: "var(--c-action)", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, padding: "6px 14px", borderRadius: "var(--radius-full)", marginBottom: 24 }}>{eyebrow}</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.4rem, 6vw, 3.6rem)", lineHeight: 1.08, letterSpacing: "-0.022em", color: "var(--c-ink)", margin: "0 0 18px" }}>
          {headline} <span style={{ color: "var(--c-action)" }}>{accent}</span>
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "var(--c-muted)", maxWidth: 600, margin: "0 auto 32px" }}>{subhead}</p>
        <div style={{ maxWidth: 540, margin: "0 auto" }}><ScanInput /></div>
      </div>
    </section>
  );
}
