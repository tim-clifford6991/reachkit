// SPEC §4 (2026-09-20, #908) and §7 (E5) — Plan below its head, while it
// waits: the stage filters, the week as its seven rows, and the day panel.
//
// Every region is drawn with `frame.ts`'s classes, which are the ones
// `CalendarView` and `WeekGrid` draw Plan with, so the same media queries
// choose the same shape here that they choose when Plan lands (issue 1484).
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";
import { BODY, DAY_OPEN, DAY_ROW, DAY_STATUS, FILTERS, REGION, WEEK_CARD, WEEK_CARD_BODY, WEEK_DAYS, WEEK_LIST } from "./frame";

export function PlanSkeleton(): React.JSX.Element {
  return (
    <Waiting className="flex min-w-0 flex-col gap-4" testId="plan-skeleton">
      <div className={FILTERS}>
        <div className="flex min-w-0 flex-wrap gap-2">
          {["w-15", "w-20", "w-29", "w-28", "w-25", "w-28"].map((width, at) => (
            <Box key={at} className={`h-8 rounded-full ${width}`} />
          ))}
        </div>
      </div>

      <div className={BODY} data-frame={REGION.body}>
        <div className={WEEK_CARD}>
          <div className={WEEK_CARD_BODY}>
            <Box className="h-6 w-64 max-w-full" />
            <div className={WEEK_LIST} data-testid="plan-skeleton-list" data-frame={REGION.week}>
              {Array.from({ length: WEEK_DAYS }, (_, at) => (
                <div key={at} className={DAY_ROW}>
                  <div className={DAY_OPEN}>
                    <Box className="h-4 w-full" />
                    <div className="flex min-w-0 flex-col gap-2">
                      <Box className="h-5 w-14" />
                      <Box className="h-4 w-3/4" />
                      <Box className="h-4 w-full" />
                    </div>
                  </div>
                  <div className={DAY_STATUS}>
                    <Box className="h-5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The day panel's place: under the week from `lg`. Below `lg` an
            unopened Plan has no panel, so nor has this. */}
        <div className="card card-border bg-base-100 hidden min-w-0 lg:flex" data-testid="plan-skeleton-panel">
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
