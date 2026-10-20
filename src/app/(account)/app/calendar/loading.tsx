// SPEC §4 (2026-09-20, #908), issues 912 and 1320 — Plan, while its read is
// in flight: the screen's own head, the four numbers, then the week in the
// shape this width draws it.
//
// The name and the line under it are the loaded screen's own (`PlanHead`),
// not boxes: nothing is read to write them, so they are there from the
// first paint and do not change. Nothing stands in for the statement of
// supply: most accounts have none, and a box for a line that does not
// arrive is a screen that jumps. Every region is `frame.ts`'s (issue 1484).
import type React from "react";
import { TilesSkeleton } from "../_shell/skeletons";
import { NUMBERS, PLAN, REGION } from "./frame";
import { PlanHead } from "./PlanHead";
import { PlanSkeleton } from "./PlanSkeleton";

export default function CalendarLoading(): React.JSX.Element {
  return (
    <div className={PLAN} data-testid="calendar-waiting">
      <PlanHead />
      <TilesSkeleton count={4} grid={NUMBERS} frame={REGION.numbers} />
      <PlanSkeleton />
    </div>
  );
}
