"use client";

/**
 * useGsapRef — §20.3 GSAP hook helper
 *
 * Returns a ref and a lazy-load function for GSAP + ScrollTrigger.
 * Checks prefers-reduced-motion before loading; returns null if reduced.
 * Safe to call in any marketing client component.
 */

import { useEffect, useRef } from "react";

type GsapModule = {
  gsap: typeof import("gsap").gsap;
  ScrollTrigger: typeof import("gsap/ScrollTrigger").ScrollTrigger;
};

let cached: GsapModule | null = null;

export function useGsap(
  callback: (modules: GsapModule) => (() => void) | void,
  deps: readonly unknown[] = [],
) {
  const callbackRef = useRef(callback);
  const cleanupRef = useRef<(() => void) | void>(undefined);

  useEffect(() => {
    // Keep the ref in sync with the latest callback inside the effect
    // (not during render) to avoid the refs-during-render lint error
    callbackRef.current = callback;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let cancelled = false;

    async function run() {
      if (!cached) {
        const { gsap } = await import("gsap");
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        cached = { gsap, ScrollTrigger };
      }
      if (cancelled) return;
      cleanupRef.current = callbackRef.current(cached);
    }

    void run();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
