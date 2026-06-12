"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useReducedMotion } from "motion/react";

interface NumberTickerProps {
  value: number;
  className?: string;
}

export function NumberTicker({ value, className }: NumberTickerProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(prefersReducedMotion ? value : 0);
  const spring = useSpring(motionValue, {
    stiffness: 80,
    damping: 20,
    mass: 0.8,
  });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      // No animation — render the final value immediately
      if (ref.current) ref.current.textContent = String(Math.round(value));
      return;
    }
    // Animate from 0 → value
    motionValue.set(0);
    const unsubscribe = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v));
    });
    // Trigger the spring toward the target
    motionValue.set(value);
    return unsubscribe;
  }, [value, spring, motionValue, prefersReducedMotion]);

  return (
    <span ref={ref} className={className}>
      {Math.round(value)}
    </span>
  );
}
