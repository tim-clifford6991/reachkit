import type { Metadata } from "next";
import { DesignDemo } from "@/components/design/design-demo";

export const metadata: Metadata = { title: "Design · Clay", robots: { index: false } };

// Clay — Confident & friendly. Warm paper, heavy tight sans, terracotta accent,
// rounder shapes and a more present shadow. Still airy and approachable, but the
// most distinctive and energetic of the three.
const css = `
.v-clay {
  --d-font-display: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --d-font-body: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --d-display-weight: 800;
  --d-display-tracking: -0.035em;
  --d-radius: 16px;
  --d-radius-lg: 26px;

  --d-bg: oklch(0.960 0.014 60);
  --d-bg-elev: oklch(0.938 0.016 58);
  --d-card: oklch(0.992 0.008 65);
  --d-text: oklch(0.27 0.022 45);
  --d-muted: oklch(0.50 0.020 48);
  --d-faint: oklch(0.63 0.018 50);
  --d-border: oklch(0.89 0.014 55);
  --d-accent: oklch(0.60 0.15 40);
  --d-accent-fg: oklch(0.99 0.01 60);
  --d-accent-strong: oklch(0.53 0.16 38);
  --d-accent-subtle: oklch(0.60 0.15 40 / 0.12);
  --d-accent-border: oklch(0.60 0.15 40 / 0.30);
  --d-good: oklch(0.56 0.10 150);
  --d-warn: oklch(0.70 0.14 55);
  --d-shadow: 0 18px 46px -16px oklch(0.45 0.10 40 / 0.32);
  --d-shadow-sm: 0 7px 20px -12px oklch(0.45 0.10 40 / 0.24);
}
.v-clay[data-mode="dark"] {
  --d-bg: oklch(0.200 0.014 40);
  --d-bg-elev: oklch(0.240 0.014 40);
  --d-card: oklch(0.235 0.014 40);
  --d-text: oklch(0.93 0.012 50);
  --d-muted: oklch(0.70 0.015 50);
  --d-faint: oklch(0.57 0.015 48);
  --d-border: oklch(1 0 0 / 0.10);
  --d-accent: oklch(0.66 0.16 42);
  --d-accent-fg: oklch(0.20 0.02 40);
  --d-accent-strong: oklch(0.72 0.15 44);
  --d-accent-subtle: oklch(0.66 0.16 42 / 0.16);
  --d-accent-border: oklch(0.66 0.16 42 / 0.32);
  --d-shadow: 0 20px 56px -16px oklch(0 0 0 / 0.62);
  --d-shadow-sm: 0 8px 24px -12px oklch(0 0 0 / 0.5);
}`;

export default function ClayPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <DesignDemo
        rootClassName="v-clay"
        active="clay"
        name="Clay — Confident · Terracotta"
        tagline="Warm paper · heavy tight sans · terracotta accent · rounder shapes"
      />
    </>
  );
}
