"use client";

/**
 * KpiStagger — wraps each KPI tile in a staggered fade/rise on load (Glassy Bento
 * Motion B). Reduced-motion users get the final state immediately. Transparent to
 * the grid: each child becomes a grid item via its motion wrapper.
 */

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

export function KpiStagger({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </>
  );
}
