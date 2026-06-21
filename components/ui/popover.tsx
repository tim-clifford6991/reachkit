"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

/**
 * Popover — backed by @base-ui/react/popover. The drill-down primitive: click a
 * number/dot to reveal the rows/evidence that already back it. Styled to the
 * elevated surface + hairline ring convention (matches dialog/tooltip).
 *
 * Usage:
 *   <Popover>
 *     <PopoverTrigger render={<button>…</button>} />
 *     <PopoverContent>…</PopoverContent>
 *   </Popover>
 */

function Popover({ children, ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root {...props}>{children}</PopoverPrimitive.Root>;
}

const PopoverTrigger = PopoverPrimitive.Trigger;

function PopoverContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner sideOffset={sideOffset} className="z-50">
        <PopoverPrimitive.Popup
          data-slot="popover"
          className={cn(
            "z-50 max-w-xs rounded-xl bg-popover p-3 text-sm text-foreground",
            "shadow-[var(--elevation-lg),var(--edge-highlight)] ring-1 ring-border",
            "origin-[var(--transform-origin)] transition-all duration-[150ms]",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
