"use client";

/**
 * ParallaxLayers — §22.1 set piece: scroll-linked depth.
 *
 * Renders decorative gradient blobs as absolutely-positioned layers and
 * translates them at different rates as the host section scrolls through the
 * viewport, creating layered depth (the Revolut "background drifts slower than
 * foreground" effect). Marketing-only — uses GSAP/ScrollTrigger via useGsap, so
 * it must only ever be imported through dynamic-wrappers (LazyParallaxLayers).
 *
 * Drop it as the first child of a `relative overflow-hidden` section:
 *   <section className="relative overflow-hidden">
 *     <LazyParallaxLayers />
 *     …content…
 *   </section>
 *
 * prefers-reduced-motion → useGsap bails, layers stay put (static decoration).
 */

import { useRef } from "react";
import { useGsap } from "./use-gsap-ref";

interface Blob {
  className: string;
  /** Parallax travel in px across the section's scroll span (negative = up). */
  speed: number;
}

const BLOBS: readonly Blob[] = [
  {
    className:
      "left-[-10%] top-[-10%] h-[40vw] w-[40vw] bg-[radial-gradient(circle,oklch(0.60_0.18_255/0.16)_0%,transparent_70%)]",
    speed: -120,
  },
  {
    className:
      "right-[-12%] top-[20%] h-[34vw] w-[34vw] bg-[radial-gradient(circle,oklch(0.55_0.20_295/0.14)_0%,transparent_70%)]",
    speed: -60,
  },
  {
    className:
      "left-[25%] bottom-[-15%] h-[36vw] w-[36vw] bg-[radial-gradient(circle,oklch(0.72_0.17_200/0.10)_0%,transparent_70%)]",
    speed: -180,
  },
] as const;

export function ParallaxLayers() {
  const rootRef = useRef<HTMLDivElement>(null);

  useGsap(({ gsap, ScrollTrigger }) => {
    const root = rootRef.current;
    if (!root) return;

    const layers = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll("[data-parallax]")
    );

    const tweens = layers.map((layer) => {
      const speed = Number(layer.dataset.parallax ?? "0");
      return gsap.to(layer, {
        y: speed,
        ease: "none",
        scrollTrigger: {
          trigger: root.parentElement ?? root,
          start: "top bottom",
          end: "bottom top",
          scrub: 1,
        },
      });
    });

    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill();
        t.kill();
      });
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          data-parallax={blob.speed}
          className={`absolute rounded-full blur-2xl will-change-transform ${blob.className}`}
        />
      ))}
    </div>
  );
}
