"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

/**
 * Tabs — backed by @base-ui/react/tabs for full accessibility.
 * Styled to the ReachKit token system:
 *  - Tab list: subtle background, no heavy border
 *  - Active indicator: accent underline (not a filled pill)
 *  - Typography: sm, medium weight
 */

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex items-center gap-0 border-b border-border",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Base layout + typography
        "relative inline-flex items-center justify-center whitespace-nowrap",
        "px-3 py-2 text-sm font-medium text-muted-foreground",
        "transition-colors duration-[150ms] outline-none",
        // Hover state
        "hover:text-foreground",
        // Active indicator: accent underline via pseudo-element
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px",
        "after:scale-x-0 after:bg-primary after:transition-transform after:duration-[200ms]",
        // When this tab is selected (Base UI sets aria-selected)
        "aria-selected:text-foreground aria-selected:after:scale-x-100",
        // Focus
        "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
