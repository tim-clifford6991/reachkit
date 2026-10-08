// SPEC §4 (2026-09-20, #908) — "No loading screens in the app: a route
// paints its shell and daisyUI `skeleton` placeholders at once and fills
// in."
//
// The shapes this product waits in. Every one is a daisyUI `skeleton` box
// — no spinner, no bar, no written line — sized to the thing that is coming
// so the screen does not move when it arrives.
//
// **They are shapes, not content, and they carry no words.** A skeleton
// that held a sentence would be a sentence the customer reads and then
// watches disappear; a skeleton that was the wrong size is a screen that
// jumps. So each one below is the box of the card it stands for, and its
// only job is to be that box.
//
// **`aria-hidden`, with the boundary announcing the wait once.** A screen
// reader read eleven empty boxes as eleven blank regions; what it is owed
// is that something is loading, which `role="status"` on the region says
// once. The boxes are decoration until they are content.
//
// **Why not one `<Skeleton>` component.** `docs/DESIGN.md`: "Do not add a
// wrapper component where a daisyUI class exists." These are functions that
// return a *composition* of `skeleton` boxes — a card's worth, a tile row's
// worth — which is the screen's own layout and is exactly what a route
// file is for. Nothing here wraps `skeleton` itself.
import type React from "react";
import { SKELETON_EXIT, ViewTransition } from "@/ui/motion";

/** One box. Spelled here so the class name is written once per shape
 *  rather than once per box, and so `height` is the only thing a caller
 *  thinks about. */
export function Box(p: { className: string }): React.JSX.Element {
  return <div className={`skeleton ${p.className}`} aria-hidden />;
}

/**
 * A region that is waiting.
 *
 * `role="status"` with `aria-busy` is what tells a screen reader that this
 * part of the page is coming, once, rather than eleven times — and
 * `data-waiting` is the layout suite's own hook for "do not measure this
 * yet" (`tests/ui/layout/browser.ts` waits for it to leave the DOM), which
 * `_fallback/Waiting.tsx` established and this keeps rather than inventing
 * a second name for the same state.
 */
export function Waiting(p: {
  children: React.ReactNode;
  className?: string;
  testId: string;
}): React.JSX.Element {
  // The Suspense reveal (#1065): when the boundary resolves, this leaves
  // and the page crossfades to what arrived.
  return (
    <ViewTransition {...SKELETON_EXIT}>
      <div
        className={p.className ?? "flex min-w-0 flex-col gap-4"}
        role="status"
        aria-busy="true"
        data-waiting=""
        data-testid={p.testId}
      >
        {p.children}
      </div>
    </ViewTransition>
  );
}

// ── the shell's own parts ───────────────────────────────────────────────

/** The domain block: a line of domain and a line of measurement. */
export function DomainSkeleton(): React.JSX.Element {
  return (
    <Waiting className="flex min-w-0 flex-col gap-2" testId="shell-domain-skeleton">
      <Box className="h-5 w-32" />
      <Box className="h-3 w-40" />
    </Waiting>
  );
}

/** The *Waiting for you* card, the onboarding line and the publishing card
 *  are each one box of their own height: the panel's lower half does not
 *  reflow when they land because each already occupies its place. */
export function PanelCardSkeleton(p: { testId: string; className: string }): React.JSX.Element {
  return (
    <Waiting className="min-w-0" testId={p.testId}>
      <Box className={p.className} />
    </Waiting>
  );
}

/** The top bar, below `lg`: the menu button at the start, then the brand. */
export function TopBarSkeleton(): React.JSX.Element {
  return (
    <Waiting
      className="navbar border-base-300 bg-base-100 min-h-0 gap-2 rounded-box border p-2 lg:hidden"
      testId="shell-top-skeleton"
    >
      <Box className="h-8 w-8 shrink-0" />
      <Box className="h-6 w-24" />
    </Waiting>
  );
}

// ── a screen's own shapes ───────────────────────────────────────────────

/** A stat tile: eyebrow, number, trend. The three tiles a row draws. */
export function TilesSkeleton(p: { count?: number }): React.JSX.Element {
  const count = p.count ?? 3;
  return (
    <Waiting className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3" testId="tiles-skeleton">
      {Array.from({ length: count }, (_, at) => (
        <div key={at} className="card card-border bg-base-100 min-w-0">
          <div className="card-body min-w-0 gap-3">
            <Box className="h-3 w-28" />
            <Box className="h-9 w-20" />
            <Box className="h-3 w-full" />
          </div>
        </div>
      ))}
    </Waiting>
  );
}

/** One card: its head and a body of `rows` lines. The shape most of this
 *  product's screens are made of. */
export function CardSkeleton(p: {
  testId: string;
  rows?: number;
  head?: boolean;
}): React.JSX.Element {
  const rows = p.rows ?? 3;
  return (
    <Waiting className="card card-border bg-base-100 min-w-0" testId={p.testId}>
      <div className="card-body min-w-0 gap-3">
        {p.head === false ? null : <Box className="h-4 w-40" />}
        {Array.from({ length: rows }, (_, at) => (
          <Box key={at} className="h-4 w-full" />
        ))}
      </div>
    </Waiting>
  );
}

/** A table: a header row and `rows` rows of it, inside a card. */
export function TableSkeleton(p: { testId: string; rows?: number }): React.JSX.Element {
  const rows = p.rows ?? 6;
  return (
    <Waiting className="card card-border bg-base-100 min-w-0" testId={p.testId}>
      <div className="card-body min-w-0 gap-3">
        <Box className="h-4 w-48" />
        <Box className="h-8 w-full" />
        {Array.from({ length: rows }, (_, at) => (
          <Box key={at} className="h-6 w-full" />
        ))}
      </div>
    </Waiting>
  );
}

/** The month grid: seven columns of cells at the height the calendar draws
 *  them, so the screen does not jump when the month lands. */
export function MonthSkeleton(): React.JSX.Element {
  return (
    <Waiting className="card card-border bg-base-100 min-w-0" testId="month-skeleton">
      <div className="card-body min-w-0 gap-3">
        <Box className="h-6 w-40" />
        <div className="grid min-w-0 grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, at) => (
            <Box key={at} className="h-20 min-w-0" />
          ))}
        </div>
      </div>
    </Waiting>
  );
}

/** The page in its frame: the browser chrome, a headline and body lines. */
export function PageSkeleton(): React.JSX.Element {
  return (
    <Waiting testId="page-skeleton">
      <Box className="h-4 w-56" />
      <div className="mockup-browser border-base-300 bg-base-200 min-w-0 border">
        <div className="mockup-browser-toolbar min-w-0">
          <Box className="h-6 w-48" />
        </div>
        <div className="bg-base-100 min-w-0 px-4 py-8 sm:px-8">
          <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-3">
            <Box className="h-10 w-4/5" />
            <Box className="h-4 w-full" />
            <Box className="h-4 w-full" />
            <Box className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </Waiting>
  );
}
