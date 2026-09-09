// BUILD §4.7, §9 — the veto window's one conversion, in a leaf that reaches
// nothing.
//
// **Why its own file** (issue #374). WO-178 step 4 puts the days-to-hours
// arithmetic in exactly one module and forbids a second copy: "a second copy
// here is the copy that goes stale, and the pair already disagreed once."
// That rule is kept, and the module is this one — `settings.ts` imports it
// and re-exports both names, so every existing caller's spelling is
// unchanged and there is still exactly one implementation.
//
// What moved is only *reachability*. `settings.ts` imports `publishDb`, so
// evaluating it parses every deployment binding — and the settings screen
// renders the window as whole days, from a pure formatter that three of the
// screen's own tests import with no database anywhere. A leaf that holds a
// number and a division can be read by both sides; the writer's module
// cannot. It is ADR-092's idiom, applied for the same reason `model.ts`
// imports `pending.ts` by file rather than through its barrel.
//
// The column stores hours (`sites.veto_hours`, §10) and the stepper offers
// whole days (`VETO.minDays`…`VETO.maxDays`); these two functions are the
// whole of the difference between those facts.

/** §4.7's own unit relationship, and the only place it is written. */
const HOURS_PER_DAY = 24;

/** Days to hours, in the one place the conversion exists. */
export function vetoHoursFromDays(days: number): number {
  return days * HOURS_PER_DAY;
}

/** Hours back to the whole days the stepper shows. */
export function vetoDaysFromHours(hours: number): number {
  return hours / HOURS_PER_DAY;
}

/** Whether a stored window is one the stepper could have asked for: a whole
 *  number of days. The range is `settings.ts`'s to check, because it is
 *  `VETO`'s; this is the shape half, and it is here so the validator and
 *  the screen agree about what "whole days" means. */
export function isWholeDays(hours: number): boolean {
  return Number.isInteger(hours) && hours % HOURS_PER_DAY === 0;
}
