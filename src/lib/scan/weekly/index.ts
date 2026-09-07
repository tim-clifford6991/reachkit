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
