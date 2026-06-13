"use client";

/**
 * AnimatedReveal — the motion.div wrapper for each report section.
 *
 * Separated into its own module so it can be lazy-loaded via next/dynamic,
 * keeping motion/react out of the initial results-page chunk.
 *
 * Reduced-motion: useReducedMotion() skips the animation and renders children
 * at their final state immediately (no layout shift, accessible).
 */

import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MOTION } from "@/components/motion/motion-config";

interface AnimatedRevealProps {
  children: ReactNode;
  index: number;
}

export function AnimatedReveal({ children, index }: AnimatedRevealProps) {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={MOTION.blurToSharp.hidden}
      animate={MOTION.blurToSharp.visible}
      transition={{
        delay: index * 0.12,
        duration: 0.6,
        ease: [0.25, 0, 0, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
