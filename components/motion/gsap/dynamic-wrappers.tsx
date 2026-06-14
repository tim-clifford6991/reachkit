"use client";

/**
 * dynamic-wrappers — §20.3 GSAP lazy client boundaries
 *
 * `ssr:false` dynamic imports must live in Client Components.
 * These thin wrappers are the ONLY place that references GSAP modules
 * via dynamic() — they never enter the (app) or (funnel) bundles because
 * they are only ever imported by marketing route files.
 *
 * Usage in Server Components (pages):
 *   import { LazyScanScrollSequence, LazyHeroGsapWrapper } from
 *     "@/components/motion/gsap/dynamic-wrappers"
 */

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

// ---------------------------------------------------------------------------
// Lazy GSAP set pieces
// ---------------------------------------------------------------------------

const ScanScrollSequenceLazy = dynamic(
  () =>
    import("./scan-scroll-sequence").then((m) => m.ScanScrollSequence),
  { ssr: false },
);

const HeroGsapWrapperLazy = dynamic(
  () =>
    import("./hero-gsap-wrapper").then((m) => m.HeroGsapWrapper),
  { ssr: false },
);

const ParallaxLayersLazy = dynamic(
  () =>
    import("./parallax-layers").then((m) => m.ParallaxLayers),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Public re-exports with stable names
// ---------------------------------------------------------------------------

export function LazyScanScrollSequence() {
  return <ScanScrollSequenceLazy />;
}

export function LazyHeroGsapWrapper({ children }: { children: ReactNode }) {
  return <HeroGsapWrapperLazy>{children}</HeroGsapWrapperLazy>;
}

export function LazyParallaxLayers() {
  return <ParallaxLayersLazy />;
}
