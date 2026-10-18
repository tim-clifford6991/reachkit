// SPEC §4 (2026-09-20, #908) and §7 (2026-10-08, issue 1340) — "A skeleton
// is the shape of the screen that arrives, on a phone and on a desktop."
//
// The layout classes of Plan, written once, as `setup/frame.ts` writes
// setup's (issue 1484). `page.tsx`, `CalendarView`, `PlanNumbers` and
// `DayList` draw Plan with them and `PlanSkeleton` draws the wait with them,
// so the regions are the same boxes before and after Plan arrives. Why each
// rule is what it is stays where it is used.
//
// `REGION` names the regions the layout gate measures twice — on the first
// paint and once Plan has arrived — at 390 and 1280
// (`tests/ui/layout/skeletons.test.ts`).
import { planWeek, type DayKey } from "./dates";

/** The screen: head, numbers, filters and the month, one under another. */
export const PLAN = "flex min-w-0 flex-col gap-4";

/** The four numbers: two columns on a phone, one row from `lg`. */
export const NUMBERS = "grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4";

/** The stage filters, with the one note on the same row. */
export const FILTERS = "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2";

/** The month (or the week) and the day panel beside it from `xl`. */
export const BODY = "grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]";

/** The month grid's card, from `lg`. */
export const MONTH_CARD = "card card-border bg-base-100 hidden p-2 lg:block";

/** This week's list, below `lg`. */
export const WEEK_SHOWN = "lg:hidden";

/** The list itself. */
export const WEEK_LIST = "list bg-base-100 rounded-box border border-base-200";

/** One day of the list: its date, its page and its number. */
export const DAY_ROW =
  "list-row grid min-h-16 w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-3 px-4 py-2.5";

/** How many days the list draws, for the skeleton: this week from Monday
 *  through the plan horizon (`planWeek`), seven to thirteen. */
export function weekRows(today: DayKey): number {
  return planWeek(today).length;
}

/** The regions the layout gate compares, by name. */
export const REGION = {
  numbers: "plan-numbers",
  body: "plan-body",
  week: "plan-week",
} as const;
