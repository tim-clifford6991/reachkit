"use client";

/**
 * MilestoneBanner — a restrained celebration when the score jumps materially
 * week-over-week (the retention "dopamine" moment from the roadmap, W3). Motion
 * spring-in; reduced-motion users get the final state immediately. Renders
 * nothing below the threshold.
 */

import { motion, useReducedMotion } from "motion/react";

const MILESTONE_DELTA = 8;

export function MilestoneBanner({ delta }: { delta: number | null }) {
  const reduce = useReducedMotion();
  if (delta == null || delta < MILESTONE_DELTA) return null;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
      style={{
        borderColor: "color-mix(in oklch, var(--color-success) 40%, transparent)",
        background: "color-mix(in oklch, var(--color-success) 8%, transparent)",
      }}
    >
      <span className="text-sm" aria-hidden>
        🎉
      </span>
      <p className="text-xs font-medium" style={{ color: "var(--color-fg)" }}>
        Score jumped{" "}
        <span className="font-semibold tabular-nums" style={{ color: "var(--color-success)" }}>
          +{delta}
        </span>{" "}
        this week — keep it going.
      </p>
    </motion.div>
  );
}
