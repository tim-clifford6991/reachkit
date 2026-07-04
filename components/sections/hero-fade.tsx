/**
 * HeroFade — the shared "vertical fade" hero backdrop for the intel-kit
 * marketing pages (how-it-works, teardowns, compare, tools) and, via
 * HERO_FADE_BG, the captured pricing page. Single source of truth for the page
 * header treatment so every non-home page's hero reads as one system: a soft
 * radial glow at the top fading into the page background.
 *
 * Server-safe: plain inline styles on --c-* tokens, no client hooks. Callers
 * pass their own hero content as children; `padding` tunes the inner container
 * spacing per page (defaults match the how-it-works hero).
 */
import type { CSSProperties, ReactNode } from "react";

/** The soft radial glow at the top of a hero, fading to transparent. Used on
 *  its own as an overlay where a full <section> wrapper can't be inserted
 *  (e.g. behind the captured pricing hero). */
export const HERO_FADE_GLOW =
  "radial-gradient(1100px 480px at 50% -8%, var(--c-soft) 0%, rgba(242,238,255,0) 62%)";

/** The glow layered over the page background — the full hero backdrop. */
export const HERO_FADE_BG = `${HERO_FADE_GLOW}, var(--c-bg)`;

export function HeroFade({
  children,
  padding = "72px 28px 44px",
  maxWidth = 1180,
  innerStyle,
}: {
  children: ReactNode;
  padding?: string;
  maxWidth?: number;
  innerStyle?: CSSProperties;
}) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: HERO_FADE_BG }}>
      <div style={{ maxWidth, margin: "0 auto", padding, textAlign: "center", ...innerStyle }}>
        {children}
      </div>
    </section>
  );
}
