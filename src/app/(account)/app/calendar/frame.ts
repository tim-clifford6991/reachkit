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

/** The screen: head, numbers, filters and the week, one under another. */
export const PLAN = "flex min-w-0 flex-col gap-4";

/** The four numbers: two columns on a phone, one row from `lg`. */
export const NUMBERS = "grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4";

/** The stage filters, with the one note on the same row. */
export const FILTERS = "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2";

/** The week, and the day panel under it. */
export const BODY = "grid min-w-0 items-start gap-4";

/** The card the week sits in, with its head, legend and how it was chosen. */
export const WEEK_CARD = "card card-border min-w-0 bg-base-100";
export const WEEK_CARD_BODY = "card-body min-w-0 gap-4 p-4";
export const WEEK_HEADING_ID = "plan-week-heading";

/** The week's seven cells, from `lg`. */
export const WEEK_GRID = "hidden min-w-0 grid-cols-7 items-stretch gap-2 lg:grid";

/** This week's list, below `lg`. */
export const WEEK_SHOWN = "lg:hidden";

/** The list itself. */
export const WEEK_LIST = "list bg-base-100 rounded-box border border-base-200";

/** One day of the list: its date, its page and its number. */
export const DAY_ROW =
  "list-row grid min-h-16 w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-3 px-4 py-2.5";

/** How many days the week draws: Monday to Sunday. */
export const WEEK_DAYS = 7;

/** The regions the layout gate compares, by name. */
export const REGION = {
  numbers: "plan-numbers",
  body: "plan-body",
  week: "plan-week",
} as const;
