// SPEC §4 *Numbers first* — Overview while its read is in flight, on the frame
// the loaded screen draws with (`_overview/frame.ts`): the head, today's page,
// the four tiles on the row's own grid, then this week's pages.
import type React from "react";
import { Box, CardSkeleton, Waiting } from "../_shell/skeletons";
import { HEAD, OVERVIEW, REGION } from "../_overview/frame";

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
      <Waiting testId="tiles-skeleton" className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" frame={REGION.tiles}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} className="h-40 w-full" />
        ))}
      </Waiting>
      <div className="min-w-0" data-frame={REGION.week}>
        <CardSkeleton testId="week-skeleton" rows={7} />
      </div>
    </div>
  );
}
