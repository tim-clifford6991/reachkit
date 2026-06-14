"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"

/**
 * Dialog — backed by @base-ui/react/dialog.
 * Styled to ReachKit design system:
 *  - Elevated surface (bg-popover) with ring-1 ring-border
 *  - Rounded xl to match panel radius convention
 *  - Backdrop: translucent dark with blur
 *  - Entrance: scale + fade (150ms spring feel)
 */

function Dialog({ children, ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
}

const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-[var(--glass-blur-strong)]",
        "transition-opacity duration-[300ms]",
        "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Portal>{children}</DialogPrimitive.Portal>
}

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog"
        className={cn(
          // Positioning
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          // Size
          "w-full max-w-lg",
          // Surface
          "rounded-2xl bg-popover p-6 shadow-[var(--elevation-xl),var(--edge-highlight)] ring-1 ring-border",
          // Animation: scale + fade from slightly below centre
          "transition-all duration-[250ms] ease-out",
          "data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:translate-y-4",
          "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:translate-y-4",
          className
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogClose
            className={cn(
              "absolute right-4 top-4 rounded-lg p-1 text-muted-foreground",
              "transition-colors duration-[150ms] hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-semibold leading-snug text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
