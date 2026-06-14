"use client";

/**
 * TiltCard — pointer-driven 3D tilt wrapper (§22.1 floating-UI signature).
 *
 * Tracks the cursor over the element and applies a subtle rotateX/rotateY with
 * perspective, springing back to flat on leave. Pair with a glass/gradient Card
 * to get the Revolut "floating product card" effect.
 *
 * Motion (framer) only — NO GSAP — so it is safe anywhere. Reduced-motion users
 * get a static, non-interactive passthrough (still rendered, just flat).
 *
 *   <TiltCard className="w-80">
 *     <Card variant="glass">…</Card>
 *   </TiltCard>
 */

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";

import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  /** Max tilt in degrees at the edges. */
  max?: number;
  className?: string;
}

export function TiltCard({ children, max = 8, className }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Normalised pointer position in [-0.5, 0.5].
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 200, damping: 20, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 200, damping: 20, mass: 0.5 });

  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={cn("[transform-style:preserve-3d]", className)}
    >
      {children}
    </motion.div>
  );
}
