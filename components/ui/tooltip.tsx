"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

/**
 * Tooltip — backed by @base-ui/react/tooltip.
 * Dark, compact, with fast show/hide matching --duration-fast (200ms).
 * No arrow by default (matches the precision-tool aesthetic).
 *
 * Usage:
 *   <TooltipProvider delay={400}>
 *     <Tooltip>
 *       <TooltipTrigger>hover me</TooltipTrigger>
 *       <TooltipContent>info</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 *
 * Or use the default delay (400ms) without wrapping in a TooltipProvider.
 */

/** Shared delay provider — wrap your tooltip groups in this for coordinated timing. */
function TooltipProvider({
  delay = 400,
  closeDelay = 100,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} closeDelay={closeDelay} {...props} />
}

function Tooltip({ children, ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
}

const TooltipTrigger = TooltipPrimitive.Trigger

function TooltipContent({
  className,
  children,
  ...props
}: TooltipPrimitive.Popup.Props) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={6}>
        <TooltipPrimitive.Popup
          data-slot="tooltip"
          className={cn(
            // Layout
            "z-50 max-w-xs rounded-md px-2.5 py-1.5",
            // Colours: elevated dark surface, readable text
            "bg-neutral-900 text-xs text-neutral-100 shadow-lg ring-1 ring-border",
            // Entrance/exit animations via data-state
            "origin-[var(--transform-origin)] transition-all duration-[150ms]",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
