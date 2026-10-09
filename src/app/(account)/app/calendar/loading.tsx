// SPEC §4 (2026-09-20, #908), issues 912 and 1320 — Plan, while its read is
// in flight: the screen's own head, the four numbers, then the month in the
// shape this width draws it.
//
// The name and the line under it are the loaded screen's own (`PlanHead`),
// not boxes: nothing is read to write them, so they are there from the
// first paint and do not change. The month switcher is a box in its place
// from `lg`, where there is a month to switch, because which month it names
// is the request's. Nothing stands in for the
// statement of supply: most accounts have none, and a box for a line that
// does not arrive is a screen that jumps.
import type React from "react";
import { PlanSkeleton, TilesSkeleton } from "../_shell/skeletons";
import { PlanHead } from "./PlanHead";

/** The numbers' own grid (`PlanNumbers.tsx`; SPEC §7, 2026-10-09, issue
 *  1364). */
const NUMBERS_GRID = "grid-cols-2 gap-3 lg:grid-cols-4";

export default function CalendarLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="calendar-waiting">
      <PlanHead>
        <div className="skeleton rounded-field hidden h-8 w-58 lg:block" aria-hidden data-testid="month-switcher-skeleton" />
      </PlanHead>
      <TilesSkeleton count={4} grid={NUMBERS_GRID} />
      <PlanSkeleton />
    </div>
  );
}
