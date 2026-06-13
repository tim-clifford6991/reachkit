"use client";

/**
 * ReportReveal — client wrapper for the four-question report sections.
 *
 * Applies blur-to-sharp stagger animation to each direct child as the page
 * mounts. Reduced-motion safe.
 *
 * Bundle note: AnimatedReveal (which imports motion/react) is lazy-loaded via
 * next/dynamic so it stays out of the initial results-page chunk. Children
 * render immediately in SSR; the animation layer only activates after
 * hydration.
 */

import { Children, isValidElement, type ReactNode } from "react";
import dynamic from "next/dynamic";

// Lazy-load AnimatedReveal — the only file that imports motion/react here.
// No loading fallback needed: children are server-rendered and visible
// immediately; the animation layer applies after the chunk loads.
const AnimatedReveal = dynamic(
  () => import("./animated-reveal").then((m) => m.AnimatedReveal),
  { ssr: false }
);

interface ReportRevealProps {
  children: ReactNode;
}

export function ReportReveal({ children }: ReportRevealProps) {
  return (
    <>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <AnimatedReveal key={i} index={i}>
            {child}
          </AnimatedReveal>
        );
      })}
    </>
  );
}
