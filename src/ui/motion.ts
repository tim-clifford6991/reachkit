/// <reference types="react/canary" />
// The motion layer's two pieces that are not CSS (owner, 2026-09-24,
// #1059 · #1065). `docs/DESIGN.md`, *The calm layer*, "Motion": one easing,
// `cubic-bezier(.2,.7,.2,1)`, and under `prefers-reduced-motion` nothing
// moves and the final state is drawn. The easing and the other timings are
// Tailwind theme values in `tailwind.css`; these two are read by React.
import * as React from "react";

/**
 * How every Recharts series draws: once, in 1.4s, on the one easing — and
 * only under `motion-safe`. Recharts 3's `"auto"` reads
 * `prefers-reduced-motion` itself and, when it is `reduce`, draws the final
 * series with no animation; on the server it draws nothing to animate. Spread
 * on a `<Line>` or `<Bar>`, never on a `<Tooltip>` (a tooltip that slides
 * after the pointer is not a series).
 */
export const SERIES_DRAW = {
  isAnimationActive: "auto",
  animationDuration: 1400,
  animationEasing: "cubic-bezier(0.2,0.7,0.2,1)",
} as const;

/**
 * Screen enter: each section of a screen rises 8px into place in 600ms,
 * 60ms after the one before it — the stagger capped at the seventh, so a
 * long list is not still arriving a second later. Spent by the two shells on
 * the element whose grandchildren (`/app`) or whose `<main>`'s children (the
 * public pages) are a screen's sections, so every screen enters without
 * touching its page. A daisyUI `skeleton` keeps its own shimmer.
 *
 * `sibling-index()` is newer than some browsers; where it is not read, the
 * delay is dropped and the sections rise together. Whole class names, for
 * Tailwind's scanner.
 */
export const ENTER_APP =
  "motion-safe:[&>*>*:not(.skeleton)]:animate-rise motion-safe:[&>*>*]:[animation-delay:min(calc((sibling-index()_-_1)_*_60ms),360ms)]!";
export const ENTER_PUBLIC =
  "motion-safe:[&_main>*:not(.skeleton)]:animate-rise motion-safe:[&_main>*]:[animation-delay:min(calc((sibling-index()_-_1)_*_60ms),360ms)]!";

/**
 * React's `<ViewTransition>`, for Suspense reveals
 * (`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).
 *
 * The App Router renders with the React build Next vendors, which exports
 * it. The stable `react` package vitest resolves does not, and there this
 * renders its children as they are — the same thing a browser without the
 * View Transitions API shows, which is the component's own fallback.
 */
export const ViewTransition: typeof React.ViewTransition =
  React.ViewTransition ??
  ((({ children }: { children?: React.ReactNode }) => children) as unknown as typeof React.ViewTransition);

/**
 * A skeleton's part in a Suspense reveal: it leaves in 150ms (`settle` in
 * `tailwind.css`) and the page crossfades to what arrived. `default: "none"`
 * keeps it out of every other transition — a navigation, an optimistic
 * action — that happens while it is mounted. Spread on a `<ViewTransition>`.
 */
export const SKELETON_EXIT = { exit: "settle", default: "none" } as const;
