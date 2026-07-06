"use client";

/**
 * MotionProvider — lazy Lenis smooth-scroll + GSAP ScrollTrigger registration
 * for the marketing surface (client-only, below the LCP path). Extracted from
 * the marketing layout so the layout itself can be a server component (auth-aware
 * nav). Disabled under prefers-reduced-motion.
 */

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

export function MotionProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    let animFrameId: number;
    let cleanupAnchors: (() => void) | null = null;
    async function init() {
      const { default: Lenis } = await import("lenis");
      const lenis = new Lenis({ duration: 1.2, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), touchMultiplier: 1.5 });
      lenisRef.current = lenis;

      // In-page # links (the hero's "See how it works" cue, the how-it-works
      // section pills) glide through Lenis instead of jumping. Neither CSS
      // scroll-behavior (fights Lenis's RAF loop — anchors freeze) nor Lenis's
      // own `anchors` option (doesn't preventDefault, so the native jump wins)
      // works here — we intercept ourselves. Reduced-motion users skip Lenis
      // entirely and keep the native instant jump, as preferred.
      const onAnchorClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
        const hash = a?.getAttribute("href");
        if (!hash || hash === "#" || !document.querySelector(hash)) return;
        e.preventDefault();
        lenis.scrollTo(hash, { offset: -24 });
        history.pushState(null, "", hash);
      };
      document.addEventListener("click", onAnchorClick);
      cleanupAnchors = () => document.removeEventListener("click", onAnchorClick);
      function raf(time: number) {
        (lenis as { raf: (t: number) => void }).raf(time);
        animFrameId = requestAnimationFrame(raf);
      }
      animFrameId = requestAnimationFrame(raf);
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);
    }
    void init();
    return () => {
      cancelAnimationFrame(animFrameId);
      cleanupAnchors?.();
      (lenisRef.current as { destroy?: () => void } | null)?.destroy?.();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
