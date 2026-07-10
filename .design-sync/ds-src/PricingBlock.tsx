/* @mirrors components/sections/captured/landing-html.ts */
import * as React from "react";
import { PlanCards } from "./PlanCards";

/**
 * PricingBlock — the landing's pricing preview: the "Pricing / One number. Then
 * a short, verified list." heading over the shared `PlanCards` grid. Mirrors the
 * pricing section of the live landing (`landing-html.ts`). The full compare
 * matrix lives on `PricingScreen` (/pricing).
 */
export interface PricingBlockProps {
  _unused?: never;
}

export function PricingBlock() {
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 28px 70px" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "var(--c-action)", textTransform: "uppercase" }}>Pricing</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36, letterSpacing: "-0.03em", margin: "12px 0 0" }}>One number. Then a short, verified list.</h2>
        <p style={{ fontSize: 16, color: "var(--c-muted)", margin: "10px 0 0" }}>Your first scan is free. Upgrade when you&apos;re ready to make that number the weekly meter of your marketing — and watch the gap close.</p>
      </div>
      <PlanCards />
    </section>
  );
}
