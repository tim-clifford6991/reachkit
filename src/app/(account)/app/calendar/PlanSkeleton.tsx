// SPEC §4 (2026-09-20, #908) and §7 (E5) — Plan below its head, while it
// waits: the stage filters with their one note, the week in the two shapes
// `CalendarView` draws it in, and the day panel.
//
// Every region is drawn with `frame.ts`'s classes, which are the ones
// `CalendarView`, `WeekGrid` and `DayList` draw Plan with, so the same media
// queries choose the same shape here that they choose when Plan lands
// (issue 1484). The week is always seven days.
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";
import { BODY, DAY_ROW, FILTERS, REGION, WEEK_CARD, WEEK_CARD_BODY, WEEK_DAYS, WEEK_GRID, WEEK_LIST, WEEK_SHOWN } from "./frame";

export function PlanSkeleton(): React.JSX.Element {
  return (
    <Waiting className="flex min-w-0 flex-col gap-4" testId="plan-skeleton">
      <div className={FILTERS}>
        <div className="flex min-w-0 flex-wrap gap-2">
          {["w-15", "w-20", "w-29", "w-28", "w-25", "w-28"].map((width, at) => (
            <Box key={at} className={`h-8 rounded-full ${width}`} />
          ))}
        </div>
        <Box className="h-4 w-82 max-w-full" />
      </div>

      <div className={BODY} data-frame={REGION.body}>
        <div className={WEEK_CARD}>
          <div className={WEEK_CARD_BODY}>
            <Box className="h-6 w-64 max-w-full" />
            <div className={WEEK_GRID} data-testid="plan-skeleton-grid">
              {Array.from({ length: WEEK_DAYS }, (_, at) => (
                <Box key={at} className="rounded-box h-40 w-full" />
              ))}
            </div>
            <div className={WEEK_SHOWN}>
              <div className={WEEK_LIST} data-testid="plan-skeleton-list" data-frame={REGION.week}>
                {Array.from({ length: WEEK_DAYS }, (_, at) => (
                  <div key={at} className={DAY_ROW}>
                    <Box className="h-9 w-full" />
                    <Box className="h-4 w-3/4" />
                    <Box className="ms-auto h-4 w-10" />
                  </div>
                ))}
              </div>
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
