/**
 * GradientMesh — ambient animated mesh background (§22.1 premium light).
 *
 * Pure CSS (no JS, no GSAP) so it is safe in EVERY bundle — marketing, funnel
 * and app. Renders layered radial blobs (--mesh-hero) that slowly drift via
 * transform-only keyframes (defined in globals.css). Reduced-motion users get a
 * static mesh — the keyframes live inside an @media (no-preference) block.
 *
 * It is `aria-hidden`, absolutely positioned and pointer-events-none, so drop
 * it as the first child of a `relative` container:
 *
 *   <section className="relative overflow-hidden">
 *     <GradientMesh />
 *     …content…
 *   </section>
 */

import { cn } from "@/lib/utils";

interface GradientMeshProps {
  /** `hero` = full ambient mesh; `subtle` = dimmed for app/header bands. */
  variant?: "hero" | "subtle";
  className?: string;
}

export function GradientMesh({ variant = "hero", className }: GradientMeshProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        variant === "subtle" && "opacity-50",
        className
      )}
    >
      <div className="absolute inset-[-25%] [background:var(--mesh-hero)] motion-safe:animate-[mesh-drift-a_22s_ease-in-out_infinite] will-change-transform" />
    </div>
  );
}
