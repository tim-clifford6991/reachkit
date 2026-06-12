"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface StaggerProps {
  children: ReactNode;
}

export function Stagger({ children }: StaggerProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div
            key={(child as { key?: string | null }).key ?? i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: 0.3,
              delay: i * 0.07,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            {child}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
