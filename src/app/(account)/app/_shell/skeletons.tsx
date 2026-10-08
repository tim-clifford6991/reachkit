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

/**
 * Plan below its head: the stage filters with their one note, the month in
 * the two shapes `calendar/CalendarView.tsx` draws it in, and the day panel.
 *
 * The classes that decide a box are that file's own — the row the filters
 * wrap in, the card around the grid from `md`, the list below it, the
 * `20rem` column the panel takes from `xl` — so the same media queries
 * choose the same shape here that they choose when the month lands. A day
 * in the grid is `DayCard`'s fixed `h-26`; a day in the list is `DayList`'s
 * three tracks at its `min-h-16`.
 *
 * Five weeks and thirty days, because a route's waiting state is not told
 * which month was asked for: most months are five rows, and the rows a
 * longer one adds are below everything else on the screen.
 */
export function PlanSkeleton(): React.JSX.Element {
  return (
    <Waiting className="flex min-w-0 flex-col gap-4" testId="plan-skeleton">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap gap-2">
          {["w-15", "w-20", "w-29", "w-28", "w-25", "w-28"].map((width, at) => (
            <Box key={at} className={`h-8 rounded-full ${width}`} />
          ))}
        </div>
        <Box className="h-4 w-82 max-w-full" />
      </div>

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="card card-border bg-base-100 hidden p-2 md:block" data-testid="plan-skeleton-grid">
            {/* A table with `MonthGrid`'s own classes, so a row here is a
                row there by the same arithmetic rather than by a number
                copied from it. */}
            <table className="w-full table-fixed border-separate border-spacing-1" aria-hidden>
              <thead>
                <tr>
                  {Array.from({ length: 7 }, (_, at) => (
                    <th key={at} className="eyebrow pb-1 text-center">
                      <span className="skeleton inline-block h-3 w-8 align-middle" aria-hidden />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }, (_, week) => (
                  <tr key={week}>
                    {Array.from({ length: 7 }, (_, at) => (
                      <td key={at} className="p-0 align-top">
                        <Box className="rounded-box h-26 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="list bg-base-100 rounded-box border border-base-200 md:hidden"
            data-testid="plan-skeleton-list"
          >
            {Array.from({ length: 30 }, (_, at) => (
              <div
                key={at}
                className="list-row grid min-h-16 w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-3 px-4 py-2.5"
              >
                <Box className="h-9 w-full" />
                <Box className="h-4 w-3/4" />
                <Box className="ms-auto h-4 w-10" />
              </div>
            ))}
          </div>
        </div>

        {/* The day panel's place: under the month from `md`, beside it from
            `xl`. Below `md` an unopened Plan has no panel, so nor has this. */}
        <div className="card card-border bg-base-100 hidden min-w-0 md:flex" data-testid="plan-skeleton-panel">
          <div className="card-body min-w-0 gap-3 p-4">
            <Box className="h-8 w-full" />
            <Box className="h-6 w-4/5" />
            <Box className="h-5 w-24" />
            <Box className="h-4 w-full" />
            <Box className="h-4 w-full" />
            <Box className="h-4 w-2/3" />
            <Box className="h-8 w-full" />
          </div>
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
