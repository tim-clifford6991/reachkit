// BUILD §11: the weekly measurement's one public entry. Four things leave the module: the site-local week, the hourly selection, the measurement,
// and the one account of a week every surface reads.
export type { DueSite } from "./due";
export { dueSites } from "./due";
export type { WeeklyOutcome, WeeklyRefusal } from "./run";
export { refreshWeeklyKnowledge, runWeekly } from "./run";
export type { UnmeasuredPart, WeekAccount } from "./account";
export { accountForWeek, nextDueOn, unmeasuredPartsOf } from "./account";
export type { WeekMovement } from "./movement";
export { previousWeekStart, weekMovement } from "./movement";
export type { LocalClock, SiteZone } from "./week";
export { isWeeklyDue, localClock, nextDueAfter, weekKey, weekStartFor } from "./week";
// The shell's "Week n" counts through `weeksAlreadyStamped`, so "a week was measured" has one meaning and one spelling (`weekKey`).
export { weeksAlreadyStamped } from "./store";
// Overview's series is a window of weeks: `readWeekScans` reads the trailing window in one round trip.
export type { WeekScan } from "./store";
export { readWeekScan, readWeekScans } from "./store";
export { readPromptWindow } from "./prompts";
