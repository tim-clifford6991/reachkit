/* @mirrors components/sections/captured/pricing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { PlanCards } from "./PlanCards";
import { Footer } from "./Footer";

/**
 * PricingScreen — the marketing pricing page (`/pricing`). The live screen
 * (`pricing-screen.tsx`) is NavBar + the captured pricing HTML + Footer, so this
 * mirror is exactly that: NavBar, the full pricing body delegated to
 * `<PlanCards page/>` (header "One number. Then a short, verified list.", the
 * Free €0 · Solo €59 · Growth €129 grid, the "Compare every plan" matrix, the
 * "Questions, answered" FAQ and the closing "Start with a free scan." CTA — one
 * source, no duplicated copy), then the footer. Self-contained; renders with no props.
 */
export interface PricingScreenProps {
  _unused?: never;
}

export function PricingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)", minHeight: "100%" }}>
      <NavBar />
      <PlanCards page />
      <Footer />
    </div>
  );
}
