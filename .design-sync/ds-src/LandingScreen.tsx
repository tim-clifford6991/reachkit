/* @mirrors components/sections/captured/landing-screen.tsx */
import * as React from "react";
import { NavBar } from "./NavBar";
import { LandingHero } from "./LandingHero";
import { CompanyTicker } from "./CompanyTicker";
import { StorySection } from "./StorySection";
import { HowItWorks } from "./HowItWorks";
import { ActionEngine } from "./ActionEngine";
import { WhySwitch } from "./WhySwitch";
import { Testimonials } from "./Testimonials";
import { Audience } from "./Audience";
import { PricingBlock } from "./PricingBlock";
import { ScoreTravels } from "./ScoreTravels";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";

/**
 * LandingScreen — the marketing home page (`/`), composed 1:1 from the live
 * section components in the SAME order the production page renders them:
 * NavBar → LandingHero → CompanyTicker → StorySection → HowItWorks →
 * ActionEngine → WhySwitch → Testimonials → Audience → PricingBlock →
 * ScoreTravels → FinalCta → Footer. Each section is its own DS component (its own
 * card in the pane); this screen is a thin composition — no page-only markup.
 */
export interface LandingScreenProps {
  _unused?: never;
}

export function LandingScreen() {
  return (
    <div style={{ background: "var(--c-bg)", fontFamily: "var(--font-sans)", color: "var(--c-ink)" }}>
      <NavBar />
      <LandingHero />
      <CompanyTicker />
      <StorySection />
      <HowItWorks />
      <ActionEngine />
      <WhySwitch />
      <Testimonials />
      <Audience />
      <PricingBlock />
      <ScoreTravels />
      <FinalCta />
      <Footer />
    </div>
  );
}
