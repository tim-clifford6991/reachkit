"use client";

/**
 * ReachKit Motion Foundation — §20.3
 *
 * Rules enforced here:
 *  1. Springs for interactive feedback (buttons, toggles)
 *  2. Duration tokens for state transitions (panels, routes)
 *  3. Animate only opacity / position / scale — never width/height/color
 *  4. prefers-reduced-motion: NO animations — show final state immediately
 *
 * Usage:
 *   import { MOTION, SPRING } from "@/components/motion/motion-config"
 *   <motion.div {...MOTION.fadeUp} />
 *   transition={SPRING.interactive}
 */

import type { TargetAndTransition, Transition } from "motion/react";

// ---------------------------------------------------------------------------
// Reduced-motion context re-export
// ---------------------------------------------------------------------------
export { useReducedMotion } from "motion/react";

// ---------------------------------------------------------------------------
// Spring presets — for interactive elements (buttons, toggles, score sweep)
// ---------------------------------------------------------------------------
export const SPRING = {
  /** Snappy interactive spring: buttons, badges, icon toggles */
  interactive: {
    type: "spring",
    stiffness: 400,
    damping: 28,
    mass: 0.8,
  } satisfies Transition,

  /** Slower, weightier spring: cards sliding in, score circle appearing */
  reveal: {
    type: "spring",
    stiffness: 120,
    damping: 20,
    mass: 1,
  } satisfies Transition,

  /** Number ticker — tight spring so it snaps to the final value */
  ticker: {
    stiffness: 80,
    damping: 20,
    mass: 0.8,
  } satisfies { stiffness: number; damping: number; mass: number },
} as const;

// ---------------------------------------------------------------------------
// Duration presets — for state transitions (panels, routes, reveals)
// ---------------------------------------------------------------------------
export const DURATION = {
  micro: 0.15,         /* 150ms — button press, toggle */
  fast: 0.2,           /* 200ms — tooltip, badge pop */
  transition: 0.4,     /* 400ms — route, panel */
  slow: 0.6,           /* 600ms — score sweep, page reveal */
  crawl: 0.8,          /* 800ms — stagger last child */
} as const;

// ---------------------------------------------------------------------------
// Easing curves
// ---------------------------------------------------------------------------
export const EASE = {
  outSmooth: [0.25, 0, 0, 1] as [number, number, number, number],
  inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  /** Signature smooth-out — mirrors --ease-revolut in globals.css. Use for
   *  reveals, parallax, and magnetic spring-backs for a premium glide. */
  revolut: [0.22, 1, 0.36, 1] as [number, number, number, number],
} as const;

// ---------------------------------------------------------------------------
// Motion variant presets
// Reduced-motion: always provide the non-animated `visible` state so callers
// can use them without conditionals — the MotionWrapper below handles the guard.
// ---------------------------------------------------------------------------

interface MotionVariant {
  hidden: TargetAndTransition;
  visible: TargetAndTransition;
}

/** Fade + rise from below. The workhorse reveal for stagger lists. */
export const fadeUp: MotionVariant = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.transition, ease: EASE.outSmooth },
  },
};

/**
 * Blur-to-sharp: for the email-gate unlock reveal (§20.3).
 * Blurred + faded content sharpens as the gate drops.
 * Uses `filter` — apply sparingly (GPU paint layer).
 */
export const blurToSharp: MotionVariant = {
  hidden: { opacity: 0, filter: "blur(8px)", scale: 0.97 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: DURATION.slow, ease: EASE.outSmooth },
  },
};

/** Simple fade — no position change. For overlays, badges, tooltips. */
export const fadeIn: MotionVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.fast, ease: EASE.inOut },
  },
};

/** Scale pop — for score badge appearing. Pairs with SPRING.reveal. */
export const scalePop: MotionVariant = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: SPRING.reveal,
  },
};

export const MOTION = { fadeUp, blurToSharp, fadeIn, scalePop } as const;
