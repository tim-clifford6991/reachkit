"use client";

/**
 * Marketing layout — §20.3
 *
 * Mounts Lenis smooth-scroll + GSAP context for the marketing route group.
 * Lazy-loaded: GSAP and Lenis are dynamic-imported below the fold so they
 * never touch the initial HTML chunk (LCP path stays CSS-only).
 *
 * prefers-reduced-motion → Lenis disabled, GSAP context skipped entirely.
 *
 * IMPORTANT: This file uses "use client" — the dynamic import with ssr:false
 * lives inside the GsapProvider, which is itself only rendered client-side.
 * The marketing page RSC content renders server-first; this layout hydrates
 * after. GSAP/Lenis never reach the (app) or (funnel) bundles.
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Lenis provider — lazy, client-only
// ---------------------------------------------------------------------------

function LenisMount() {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    // Bail out if the user prefers reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let animFrameId: number;

    async function init() {
      const { default: Lenis } = await import("lenis");

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        touchMultiplier: 1.5,
      });

      lenisRef.current = lenis;

      function raf(time: number) {
        (lenis as { raf: (t: number) => void }).raf(time);
        animFrameId = requestAnimationFrame(raf);
      }

      animFrameId = requestAnimationFrame(raf);
    }

    void init();

    return () => {
      cancelAnimationFrame(animFrameId);
      (lenisRef.current as { destroy?: () => void } | null)?.destroy?.();
      lenisRef.current = null;
    };
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// GSAP ScrollTrigger registration — lazy, client-only
// ---------------------------------------------------------------------------

function GsapInit() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    async function init() {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
    }

    void init();
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Lazy animation infra — never blocks the first paint */}
      <LenisMount />
      <GsapInit />
      <div style={{ background: "var(--color-bg)", minHeight: "100dvh" }}>
        {children}
      </div>
    </>
  );
}
