// SPEC §4 (2026-09-20, #908) and §7 (2026-10-08, issue 1340) — "A skeleton
// is the shape of the screen that arrives, on a phone and on a desktop."
//
// The layout classes of Plan, written once, as `setup/frame.ts` writes
// setup's (issue 1484). `page.tsx`, `CalendarView` and `WeekGrid`
// draw Plan with them and `PlanSkeleton` draws the wait with them,
// so the regions are the same boxes before and after Plan arrives. Why each
// rule is what it is stays where it is used.
//
// `REGION` names the regions the layout gate measures twice — on the first
// paint and once Plan has arrived — at 390 and 1280
// (`tests/ui/layout/skeletons.test.ts`).

/** The screen: head and the week, one under another. */
export const PLAN = "flex min-w-0 flex-col gap-4";

/** The week, and the day panel under it. */
export const BODY = "grid min-w-0 items-start gap-4";

/** The card the week sits in, with its head, next Monday and how it was chosen. */
export const WEEK_CARD = "card card-border min-w-0 bg-base-100";
export const WEEK_CARD_BODY = "card-body min-w-0 gap-4 p-4";
export const WEEK_HEADING_ID = "plan-week-heading";

/** The week: one row per day, at every width. */
export const WEEK_LIST = "flex min-w-0 flex-col gap-2.5";

/** One day: date, page and why, then its status; the status stacks under the page on a phone. */
export const DAY_ROW = "card card-border grid min-w-0 grid-cols-1 gap-2 bg-base-100 p-4 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-4";

/** The date and the page, as the one button that opens the day. */
export const DAY_OPEN = "grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] items-start gap-3 text-left sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-4";

/** The status column, indented under the page on a phone (date column + gap). */
export const DAY_STATUS = "ms-18 flex min-w-0 flex-col items-start gap-1 sm:ms-0 sm:items-end";

/** How many days the week draws: Monday to Sunday. */
export const WEEK_DAYS = 7;

/** The regions the layout gate compares, by name. */
export const REGION = {
  body: "plan-body",
  week: "plan-week",
} as const;
