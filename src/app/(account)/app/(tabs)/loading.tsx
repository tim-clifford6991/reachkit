// SPEC §4 (2026-09-20, #908 · 2026-10-07, issue 1319) — Overview, while
// its read is in flight.
//
// "A skeleton is the shape of the screen that arrives, on a phone and on a
// desktop." The boxes below are the new Overview's own, in its own order
// and on its own grids: the action for the page in review, the four
// headline numbers — two columns on a phone, one row from `lg` — then this
// week beside needs-you from `xl` and above it below. What arrives lands
// where its box already is and nothing on the screen moves.
//
// It is **inside** the tabs' layout, so the four tab links are drawn and
// stay drawn while the well waits: the customer can leave for Search, AI
// answers or Rivals without the screen they are leaving finishing first.
//
// A Server Component: it reads nothing at all.
import type React from "react";
import { CardSkeleton, TilesSkeleton } from "../_shell/skeletons";

/** The headline numbers' own grid (`_overview/LinkedTiles.tsx`). */
const TILES_GRID = "grid-cols-2 gap-3 lg:grid-cols-4";

export default function OverviewLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview-waiting">
      <CardSkeleton testId="waiting-page-skeleton" rows={2} />
      <TilesSkeleton count={4} grid={TILES_GRID} />
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CardSkeleton testId="week-skeleton" rows={2} />
        <CardSkeleton testId="needs-you-skeleton" rows={2} />
      </div>
    </div>
  );
}
