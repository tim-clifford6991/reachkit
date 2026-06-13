"use client";

/**
 * ReachKit ThemeProvider
 *
 * Thin wrapper around next-themes. Default theme is dark (developer ICP).
 * Exported from here (not directly from next-themes) so we have one seam
 * to extend with MotionConfig, reduced-motion context, etc. in the future.
 *
 * `suppressHydrationWarning` on <html> in layout.tsx + disableTransitionOnChange
 * eliminates flash-of-unstyled-content on first render.
 */
export { ThemeProvider } from "next-themes";
export type { ThemeProviderProps } from "next-themes";
