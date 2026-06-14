"use client";

/**
 * Magnetic — pointer-following spring wrapper for primary CTAs (§22.1).
 *
 * On hover the child translates a few px toward the cursor and springs back on
 * leave — the classic Revolut/Linear "magnetic button" micro-interaction.
 *
 * Built on Motion (framer) only — NO GSAP — so it is safe in the app/funnel
 * bundles. Use sparingly (primary CTAs) to protect the bundle/perf budget.
 *
 * Reduced-motion: renders a static passthrough (no listeners, no transform).
 *
 *   <Magnetic><Button variant="gradient">Scan my site</Button></Magnetic>
 */

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "motion/react";

import { cn } from "@/lib/utils";

interface MagneticProps {
  children: React.ReactNode;
  /** Max pull distance in px (how far the element drifts toward the cursor). */
  strength?: number;
  className?: string;
}

export function Magnetic({ children, strength = 6, className }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 18, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 250, damping: 18, mass: 0.6 });

  if (reduced) {
    return <span className={cn("inline-flex", className)}>{children}</span>;
  }

  function onMove(e: React.MouseEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    // Normalise to [-1, 1] across the element, then scale by strength.
    x.set((relX / (rect.width / 2)) * strength);
    y.set((relY / (rect.height / 2)) * strength);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: springX, y: springY }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.span>
  );
}
