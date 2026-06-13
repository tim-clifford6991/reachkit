"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "@/lib/utils"

interface ProgressProps {
  value?: number
  max?: number
  className?: string
  /** Visual variant — default uses accent; success uses green state colour */
  variant?: "default" | "success" | "warning" | "danger"
}

const variantFill: Record<NonNullable<ProgressProps["variant"]>, string> = {
  default: "bg-primary",
  success: "bg-[oklch(0.72_0.17_155)]",
  warning: "bg-[oklch(0.78_0.18_70)]",
  danger:  "bg-[oklch(0.70_0.20_22)]",
}

/**
 * Progress — linear progress bar backed by Base UI's accessible primitive.
 *
 * Consumed by:
 *  - Score breakdown subscores (with variant matching the subscore state)
 *  - Scan-in-progress loading bars
 *
 * The fill colour comes from the design-system state colour palette; the track
 * uses the muted surface so it reads at any fill level.
 */
function Progress({ value = 0, max = 100, className, variant = "default" }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const fill = variantFill[variant]

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-muted/60",
        className
      )}
    >
      <ProgressPrimitive.Track className="absolute inset-0">
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full rounded-full transition-all duration-[600ms] ease-out",
            fill
          )}
          style={{ width: `${pct}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
