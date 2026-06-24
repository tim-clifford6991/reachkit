import type { Metadata } from "next";
import { DesignDemo } from "@/components/design/design-demo";

export const metadata: Metadata = { title: "Design · Violet", robots: { index: false } };

// Violet Discoverability — the new ReachKit direction, ported from the Claude
// Design mockup (ReachKit.dc.html). Clean near-white surfaces, a vivid violet
// brand (#6E56F7), ink near-black text, geometric Space Grotesk display +
// Plus Jakarta Sans body. Confident, modern, analytics-product.
const css = `
.v-reachkit {
  --d-font-display: var(--font-space-grotesk), 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
  --d-font-body: var(--font-plus-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  --d-display-weight: 600;
  --d-display-tracking: -0.02em;
  --d-radius: 12px;
  --d-radius-lg: 20px;

  --d-bg: oklch(1 0 0);                       /* #fff page */
  --d-bg-elev: oklch(0.975 0.008 290);        /* #FAFAFC / faint violet wash */
  --d-card: oklch(1 0 0);
  --d-text: oklch(0.20 0.012 286);            /* #14131A ink */
  --d-muted: oklch(0.48 0.012 288);           /* #56535F */
  --d-faint: oklch(0.63 0.012 288);           /* #8A8794 */
  --d-border: oklch(0.93 0.005 288);          /* #EEEDF3 hairline */
  --d-accent: oklch(0.56 0.20 285);           /* #6E56F7 brand violet */
  --d-accent-fg: oklch(0.99 0.005 285);       /* white on violet */
  --d-accent-strong: oklch(0.52 0.20 285);    /* violet text on white (AA) */
  --d-accent-subtle: oklch(0.56 0.20 285 / 0.11);
  --d-accent-border: oklch(0.56 0.20 285 / 0.28);
  --d-good: oklch(0.62 0.13 155);             /* #1F9D5B */
  --d-warn: oklch(0.66 0.16 50);              /* #E0731C orange */
  --d-shadow: 0 18px 50px -16px oklch(0.42 0.16 285 / 0.30);
  --d-shadow-sm: 0 6px 20px -10px oklch(0.42 0.16 285 / 0.20);
}
.v-reachkit[data-mode="dark"] {
  --d-bg: oklch(0.17 0.012 288);              /* #0E0D14 near-black violet */
  --d-bg-elev: oklch(0.225 0.012 288);        /* #16151F */
  --d-card: oklch(0.21 0.012 288);            /* #14131A card */
  --d-text: oklch(0.95 0.005 290);
  --d-muted: oklch(0.70 0.010 290);
  --d-faint: oklch(0.58 0.010 290);
  --d-border: oklch(1 0 0 / 0.10);
  --d-accent: oklch(0.60 0.20 285);
  --d-accent-fg: oklch(0.99 0.005 285);
  --d-accent-strong: oklch(0.80 0.13 287);    /* lighter violet for text on dark */
  --d-accent-subtle: oklch(0.66 0.18 285 / 0.18);
  --d-accent-border: oklch(0.66 0.18 285 / 0.34);
  --d-good: oklch(0.74 0.13 155);
  --d-warn: oklch(0.74 0.15 55);
  --d-shadow: 0 18px 52px -14px oklch(0 0 0 / 0.62);
  --d-shadow-sm: 0 7px 22px -12px oklch(0 0 0 / 0.5);
}`;

export default function ReachKitPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <DesignDemo
        rootClassName="v-reachkit"
        active="reachkit"
        name="Violet Discoverability"
        tagline="Clean white surfaces · violet brand · Space Grotesk display"
      />
    </>
  );
}
