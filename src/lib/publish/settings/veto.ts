// BUILD §4.7, §9 — the veto window's one conversion and its floor. The days-to-hours arithmetic lives in exactly one
// module, never a second copy; `settings.ts` re-exports it.
// A leaf reaching only the pinned constants, because `settings.ts` parses every deployment binding and the settings
// screen's pure formatter must not (ADR-092).
// The column stores hours (`sites.veto_hours`, §10) and the stepper offers whole days (`VETO.minDays`…`VETO.maxDays`).
import { VETO } from "@/lib/config/constants";

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

/** Whether a stored window is a whole number of days, so the validator and the screen agree on "whole days".
 *  The range is `settings.ts`'s to check. */
export function isWholeDays(hours: number): boolean {
  return Number.isInteger(hours) && hours % HOURS_PER_DAY === 0;
}

/** The window a stored `sites.veto_hours` governs with. SPEC §7, "range 1–7 days, never zero": below the floor reads
 *  as the floor, missing as the default. Every reader of the pair goes through here, so nothing gets under a day. */
export function governingVetoHours(stored: number | null | undefined): number {
  if (typeof stored !== "number") return VETO.defaultHours;
  return Math.max(stored, vetoHoursFromDays(VETO.minDays));
}
