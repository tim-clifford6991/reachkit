"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Avatar — circular user avatar with initials fallback.
 * Sized via the `size` prop. Accent-coloured fallback background
 * uses the design token subtle accent wash.
 *
 * Base UI doesn't have an Avatar primitive; this is hand-composed.
 */

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- all sizes are valid but only md/lg used today; keep for E2-E4
const sizeClasses: Record<AvatarSize, string> = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-xs",
  md: "size-8 text-sm",
  lg: "size-10 text-base",
  xl: "size-12 text-lg",
}

interface AvatarProps extends React.ComponentProps<"span"> {
  src?: string
  alt?: string
  initials?: string
  size?: AvatarSize
}

function Avatar({ src, alt = "", initials, size = "md", className, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false)
  const showFallback = !src || imgError

  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-subtle ring-1 ring-border",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: "oklch(0.60 0.18 255 / 0.12)" }}
      {...props}
    >
      {!showFallback && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setImgError(true)}
        />
      )}
      {showFallback && (
        <span className="select-none font-mono font-medium uppercase leading-none text-[oklch(0.74_0.13_255)]">
          {initials ?? alt.slice(0, 2)}
        </span>
      )}
    </span>
  )
}

export { Avatar }
