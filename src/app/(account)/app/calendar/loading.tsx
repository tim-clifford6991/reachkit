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
//
// Every region is `frame.ts`'s (issue 1484). The week below `lg` is as many
// rows as the list that arrives: Monday through the plan horizon, counted
// from the screen's own today (`planToday`) — the fixture's day for the
// reserved fixture account, the site's zone for every other. The account
// is the `/app` layout's, already read before this draws.
import type React from "react";
import { TilesSkeleton } from "../_shell/skeletons";
import { NUMBERS, PLAN, REGION, weekRows } from "./frame";
import { PlanHead } from "./PlanHead";
import { PlanSkeleton } from "./PlanSkeleton";
import { planToday } from "./provider";

export default async function CalendarLoading(): Promise<React.JSX.Element> {
  const rows = weekRows(await planToday());
  return (
    <div className={PLAN} data-testid="calendar-waiting">
      <PlanHead>
        <div className="skeleton rounded-field hidden h-8 w-58 lg:block" aria-hidden data-testid="month-switcher-skeleton" />
      </PlanHead>
      <TilesSkeleton count={4} grid={NUMBERS} frame={REGION.numbers} />
      <PlanSkeleton rows={rows} />
    </div>
  );
}
