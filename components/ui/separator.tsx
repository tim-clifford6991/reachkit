import * as React from "react"
import { cn } from "@/lib/utils"

interface SeparatorProps extends React.ComponentProps<"div"> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

/**
 * Separator — thin rule dividing sections.
 * Uses the --border token: translucent white overlay in dark mode,
 * a visible line in light mode. Purely presentational by default.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <div
      data-slot="separator"
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
