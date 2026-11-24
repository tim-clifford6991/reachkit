// SPEC §4 *Numbers first* — Overview while its read is in flight, on the frame
// the loaded screen draws with (`_overview/frame.ts`): the head, today's page,
// the four tiles on the row's own grid, then this week's pages.
import type React from "react";
import { Box, CardSkeleton, Waiting } from "../../_shell/skeletons";
import { HEAD, OVERVIEW, REGION } from "../../_overview/frame";
import { TilesSkeleton } from "../../_overview/skeletons";

export default function OverviewLoading(): React.JSX.Element {
  return (
    <div className={OVERVIEW} data-testid="overview-waiting">
      <div className={HEAD}>
        <Waiting testId="head-skeleton" className="flex min-w-0 flex-col gap-2">
          <Box className="h-4 w-48" />
          <Box className="h-16 w-full max-w-md lg:h-9" />
          <Box className="h-10 w-full max-w-xl lg:h-5" />
        </Waiting>
      </div>
      <CardSkeleton testId="waiting-page-skeleton" rows={2} />
      <TilesSkeleton />
      {/* One line below `lg`, the seven-day grid from `lg`, as `ThisWeek` draws them. */}
      <div className="min-w-0" data-frame={REGION.week}>
        <Waiting testId="week-skeleton" className="card card-border min-w-0 bg-base-100">
          <div className="card-body gap-2 p-4 lg:hidden">
            <Box className="h-5 w-40" />
            <Box className="h-4 w-28" />
          </div>
          <div className="card-body hidden gap-3.5 p-6 lg:flex">
            <Box className="h-7 w-56" />
            <div className="grid grid-cols-7 gap-2.5">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Box key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </Waiting>
      </div>
    </div>
  );
}
