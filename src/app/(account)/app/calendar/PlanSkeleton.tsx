// SPEC §4 (2026-09-20, #908) and §7 (2026-10-08, issue 1340) — Plan below
// its head, while it waits: the stage filters with their one note, Plan in
// the two shapes `CalendarView` draws it in, and the day panel.
//
// Every region is drawn with `frame.ts`'s classes, which are the ones
// `CalendarView` and `DayList` draw Plan with, so the same media queries
// choose the same shape here that they choose when Plan lands (issue 1484).
// A day in the grid is `DayCard`'s fixed `h-26`.
//
// Below `lg` it is `rows` rows: this week from Monday through the plan
// horizon, as many as the list that arrives (`weekRows`). From `lg` it is
// five weeks, because a route's waiting state is not told which month was
// asked for: most months are five rows, and the row a longer one adds is
// below everything else on the screen.
import type React from "react";
import { Box, Waiting } from "../_shell/skeletons";
import { BODY, DAY_ROW, FILTERS, MONTH_CARD, REGION, WEEK_LIST, WEEK_SHOWN } from "./frame";

export function PlanSkeleton(p: { rows: number }): React.JSX.Element {
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
        <div className="min-w-0">
          <div className={MONTH_CARD} data-testid="plan-skeleton-grid">
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
          <div className={WEEK_SHOWN}>
            <div className={WEEK_LIST} data-testid="plan-skeleton-list" data-frame={REGION.week}>
              {Array.from({ length: p.rows }, (_, at) => (
                <div key={at} className={DAY_ROW}>
                  <Box className="h-9 w-full" />
                  <Box className="h-4 w-3/4" />
                  <Box className="ms-auto h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The day panel's place: under the month from `lg`, beside it from
            `xl`. Below `lg` an unopened Plan has no panel, so nor has this. */}
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
