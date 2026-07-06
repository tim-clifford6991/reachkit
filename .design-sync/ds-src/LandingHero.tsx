import * as React from "react";
import { ScanInput } from "./ScanInput";

/**
 * LandingHero — the marketing hero: a soft radial-fade backdrop, an evidence
 * pill (dot + trust line), a big display headline (all three phrases at ONE
 * size; the negative phrase highlighted + italic, the closing phrase in the
 * violet action colour), a supporting subhead, and the ScanInput conversion
 * control with its trust line. Mirrors the live ReachKit landing hero. Renders
 * fully with no props.
 */
export interface LandingHeroProps {
  eyebrow?: string;
  headline?: string;
  /** Italic emphasis phrase, rendered right after the headline. */
  emphasis?: string;
  /** Violet-accented closing phrase. */
  accent?: string;
  subhead?: string;
}

export function LandingHero({
  eyebrow = "Grounded in your live page. Every claim links to real evidence.",
  headline = "Your competitors are being found.",
  emphasis = "You aren't.",
  accent = "See exactly why.",
  subhead = "Paste your URL. In under a minute ReachKit reads your live page the way a buyer's search does — then shows you the searches your rivals win, the score that measures the gap, and the ranked fixes that close it.",
}: LandingHeroProps) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242,238,255,0) 62%), var(--c-bg)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "70px 28px 52px", textAlign: "center" }}>
        {/* Evidence pill — dot + trust line */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            background: "var(--c-surface)",
            border: "1px solid var(--c-soft)",
            borderRadius: "var(--radius-full)",
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--c-action)",
            boxShadow: "0 1px 2px rgba(20,19,26,0.04)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-action)", display: "inline-block" }} />
          {eyebrow}
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "clamp(2.1rem, 5.4vw, 3.56rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: "var(--c-ink)",
            margin: "22px auto 0",
            maxWidth: 860,
            textWrap: "balance",
          }}
        >
          {headline}{" "}
          <em
            style={{
              // Highlight marker for the negative phrase — a soft red drawn
              // from the score palette (var(--c-band-invisible)), NOT a new
              // colour. Same font size as the rest of the headline; italic.
              fontStyle: "italic",
              background: "color-mix(in oklab, var(--c-band-invisible) 16%, transparent)",
              color: "var(--c-ink)",
              padding: "0 0.16em",
              borderRadius: "0.4em",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {emphasis}
          </em>{" "}
          <span style={{ color: "var(--c-action)" }}>{accent}</span>
        </h1>

        <p
          style={{
            fontSize: 19,
            lineHeight: 1.55,
            color: "var(--c-muted)",
            maxWidth: 600,
            margin: "20px auto 0",
            textWrap: "pretty",
          }}
        >
          {subhead}
        </p>

        <div style={{ maxWidth: 560, margin: "32px auto 0" }}>
          <ScanInput placeholder="yourdomain.com" note="Under a minute · No login for your first scan · Try: bloom.io" />
        </div>
      </div>
    </section>
  );
}
