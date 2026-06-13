import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Label — accessible form label.
 * Wraps <label> directly (no Base UI needed; it's a native element).
 * Styled to the ReachKit token system.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
