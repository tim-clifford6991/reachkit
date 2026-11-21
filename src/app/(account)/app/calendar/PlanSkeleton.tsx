// The waiting shape of This Week: the cards' column, and the pane beside it
// from `lg`, in the screen's own frame so the two are one shape.
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";
import { BODY, COLUMN, DAY_ROW, REGION, WEEK_DAYS, WEEK_LIST } from "./frame";

export function PlanSkeleton(): React.JSX.Element {
  return (
    <Waiting className={BODY} testId="plan-skeleton" frame={REGION.body}>
      <div className={COLUMN}>
        <div
          className={WEEK_LIST}
          data-testid="plan-skeleton-list"
          data-frame={REGION.week}
        >
          {Array.from({ length: WEEK_DAYS }, (_, at) => (
            <div key={at} className={DAY_ROW}>
              <Box className="h-5 w-full" />
              <Box className="h-4 w-3/4" />
              <Box className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* The pane's place, beside the cards from `lg`. Below `lg` an unopened week has no pane, so nor has this. */}
      <div
        className="card card-border bg-base-100 hidden min-w-0 lg:flex"
        data-testid="plan-skeleton-panel"
      >
        <div className="card-body min-w-0 gap-3 p-4">
          <Box className="h-5 w-1/2" />
          <Box className="h-7 w-4/5" />
          <Box className="h-8 w-40" />
          <Box className="h-4 w-full" />
          <Box className="h-4 w-full" />
          <Box className="h-4 w-2/3" />
        </div>
      </div>
    </Waiting>
  );
}
