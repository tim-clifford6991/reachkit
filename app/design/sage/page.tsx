import type { Metadata } from "next";
import { DesignDemo } from "@/components/design/design-demo";

export const metadata: Metadata = { title: "Design · Sage", robots: { index: false } };

// Sage — Clean & organic. Warm off-white, charcoal sans, muted sage/olive green
// accent. The most Notion/Stripe-like: hairline borders, very soft shadows,
// disciplined and calm. Green reads "growth" without shouting.
const css = `
.v-sage {
  --d-font-display: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --d-font-body: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --d-display-weight: 700;
  --d-display-tracking: -0.025em;
  --d-radius: 10px;
  --d-radius-lg: 16px;

  --d-bg: oklch(0.965 0.008 120);
  --d-bg-elev: oklch(0.944 0.010 125);
  --d-card: oklch(0.995 0.004 120);
  --d-text: oklch(0.27 0.015 150);
  --d-muted: oklch(0.49 0.015 150);
  --d-faint: oklch(0.63 0.012 150);
  --d-border: oklch(0.89 0.010 135);
  --d-accent: oklch(0.55 0.09 150);
  --d-accent-fg: oklch(0.99 0.01 150);
  --d-accent-strong: oklch(0.47 0.09 152);
  --d-accent-subtle: oklch(0.55 0.09 150 / 0.12);
  --d-accent-border: oklch(0.55 0.09 150 / 0.28);
  --d-good: oklch(0.55 0.10 150);
  --d-warn: oklch(0.70 0.13 60);
  --d-shadow: 0 10px 32px -14px oklch(0.35 0.03 150 / 0.22);
  --d-shadow-sm: 0 1px 2px oklch(0.30 0.02 150 / 0.07), 0 3px 10px -6px oklch(0.30 0.02 150 / 0.12);
}
.v-sage[data-mode="dark"] {
  --d-bg: oklch(0.190 0.010 150);
  --d-bg-elev: oklch(0.230 0.010 150);
  --d-card: oklch(0.225 0.010 150);
  --d-text: oklch(0.93 0.010 140);
  --d-muted: oklch(0.70 0.012 145);
  --d-faint: oklch(0.56 0.012 145);
  --d-border: oklch(1 0 0 / 0.10);
  --d-accent: oklch(0.70 0.11 150);
  --d-accent-fg: oklch(0.18 0.02 150);
  --d-accent-strong: oklch(0.75 0.11 150);
  --d-accent-subtle: oklch(0.70 0.11 150 / 0.16);
  --d-accent-border: oklch(0.70 0.11 150 / 0.30);
  --d-shadow: 0 16px 50px -14px oklch(0 0 0 / 0.6);
  --d-shadow-sm: 0 6px 20px -12px oklch(0 0 0 / 0.5);
}`;

export default function SagePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <DesignDemo
        rootClassName="v-sage"
        active="sage"
        name="Sage — Clean · Green"
        tagline="Warm off-white · charcoal sans · muted sage-green accent"
      />
    </>
  );
}
