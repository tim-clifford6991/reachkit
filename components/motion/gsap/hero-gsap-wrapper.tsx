"use client";

/**
 * HeroGsapWrapper — client boundary for GSAP hero enhancement
 *
 * Wraps the hero section ref and fires the SplitText reveal after hydrate.
 * The headline HTML is already in the DOM from SSR — this component
 * simply enhances it; content is visible at all times (no FOUC).
 *
 * Used by app/(marketing)/page.tsx: import this and wrap the hero region.
 */

import type { ReactNode } from "react";
import { useHeroSplitReveal } from "./hero-split-reveal";

interface HeroGsapWrapperProps {
  children: ReactNode;
}

export function HeroGsapWrapper({ children }: HeroGsapWrapperProps) {
  const containerRef = useHeroSplitReveal({
    headlineSelector: "[data-hero-headline]",
    accentSelector: "[data-hero-accent]",
  });

  return <div ref={containerRef}>{children}</div>;
}
