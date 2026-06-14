import type { Metadata } from "next";
import { DesignDemo } from "@/components/design/design-demo";

export const metadata: Metadata = { title: "Design · Almanac", robots: { index: false } };

// Almanac — Editorial. Warm cream paper, ink-brown serif display, honey/amber
// accent. Calm, human, magazine-like. Stripe/Notion clarity with a warmer soul.
const css = `
.v-almanac {
  --d-font-display: 'Iowan Old Style','Palatino Linotype',Palatino,'Hoefler Text',Georgia,Cambria,serif;
  --d-font-body: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --d-display-weight: 500;
  --d-display-tracking: -0.01em;
  --d-radius: 14px;
  --d-radius-lg: 22px;

  --d-bg: oklch(0.975 0.012 80);
  --d-bg-elev: oklch(0.953 0.014 78);
  --d-card: oklch(0.995 0.006 85);
  --d-text: oklch(0.28 0.020 60);
  --d-muted: oklch(0.50 0.020 62);
  --d-faint: oklch(0.64 0.018 65);
  --d-border: oklch(0.89 0.014 72);
  --d-accent: oklch(0.66 0.13 66);
  --d-accent-fg: oklch(0.99 0.01 85);
  --d-accent-strong: oklch(0.55 0.13 60);
  --d-accent-subtle: oklch(0.66 0.13 66 / 0.12);
  --d-accent-border: oklch(0.66 0.13 66 / 0.30);
  --d-good: oklch(0.56 0.10 150);
  --d-warn: oklch(0.70 0.14 55);
  --d-shadow: 0 14px 44px -14px oklch(0.42 0.05 60 / 0.28);
  --d-shadow-sm: 0 5px 18px -10px oklch(0.42 0.05 60 / 0.20);
}
.v-almanac[data-mode="dark"] {
  --d-bg: oklch(0.205 0.012 60);
  --d-bg-elev: oklch(0.245 0.012 60);
  --d-card: oklch(0.235 0.012 60);
  --d-text: oklch(0.93 0.012 75);
  --d-muted: oklch(0.70 0.015 72);
  --d-faint: oklch(0.58 0.015 70);
  --d-border: oklch(1 0 0 / 0.10);
  --d-accent: oklch(0.76 0.12 75);
  --d-accent-fg: oklch(0.20 0.02 60);
  --d-accent-strong: oklch(0.81 0.12 78);
  --d-accent-subtle: oklch(0.76 0.12 75 / 0.16);
  --d-accent-border: oklch(0.76 0.12 75 / 0.32);
  --d-shadow: 0 18px 52px -14px oklch(0 0 0 / 0.62);
  --d-shadow-sm: 0 7px 22px -12px oklch(0 0 0 / 0.5);
}`;

export default function AlmanacPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <DesignDemo
        rootClassName="v-almanac"
        active="almanac"
        name="Almanac — Editorial · Honey"
        tagline="Warm cream paper · ink serif headlines · honey accent"
      />
    </>
  );
}
