// BUILD §11 — the weekly measurement's one public entry
//
// ARCHITECTURE gives `src/lib/scan/**` "the one scan pipeline … and the
// stored report"; this leaf is the weekly cadence over it. Four things
// leave the module and nothing else does: the site-local week, the hourly
// selection, the measurement, and the one account of a week every surface
// reads (§4.4, §4.5, §4.6 and the Monday mail read this and derive no
// second account of the same week).
export type { DueSite } from "./due";
export { dueSites } from "./due";
export type { WeeklyOutcome, WeeklyRefusal } from "./run";
export { runWeekly } from "./run";
export type { UnmeasuredPart, WeekAccount } from "./account";
export { accountForWeek, nextDueOn, unmeasuredPartsOf } from "./account";
export type { ActiveAccessGate } from "./access";
export { registerActiveAccessGate } from "./access";
export type { WeekMovement } from "./movement";
export { previousWeekStart, weekMovement } from "./movement";
export type { LocalClock, SiteZone } from "./week";
export { isWeeklyDue, localClock, nextDueAfter, weekKey, weekStartFor } from "./week";
// §4.4's domain block states "Week n", counted over the weeks this module
// has rows for. `weeksAlreadyStamped` is that read — one query for a list
// of `(site_id, week_start)` pairs — and the shell asks it here rather than
// counting weekly rows for itself, so "a week was measured" has one meaning
// and one spelling (`weekKey`) across the tick that writes them and the
// screen that counts them (issue #169).
export { weeksAlreadyStamped } from "./store";
