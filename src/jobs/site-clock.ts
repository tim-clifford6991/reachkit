// src/jobs/site-clock.ts — BUILD §11
//
// ADR-060, verbatim: "Weekly measurement is triggered hourly and gated on
// each site's own local Monday; 'Mon 06:00 UTC' is not the trigger." The
// same shape serves `draft/generate`'s evening, and this file is that
// half: the daily gate and the date a draft generated tonight is for.
//
// **The week itself is not here.** Where each site's Monday starts, what
// it is keyed by and when the next measurement is due all live in
// `src/lib/scan/weekly/week.ts` (issue #41) — the engine leaf that also
// stamps the measurement with it — so the label a scan is stored under and
// the label a tick decides on are one derivation and not two. This file
// reads `localClock` from there rather than keeping a second copy of it;
// `src/jobs/` may import `src/lib/`, and never the other way about
// (ARCHITECTURE rule 2).
//
// A tick lands once an hour, so "due" means "this is the site's due hour" —
// a window one hour wide in the site's own clock. Two ticks inside one such
// hour cannot happen; a tick the platform missed is a run the site does not
// get that day, which the engine's own constraint tolerates.
import { DRAFT_DUE_HOUR_LOCAL } from "@/lib/config/constants";
// The leaf, not the module's index: the index also carries the selection
// and the measurement, which reach the database, and the daily gate needs
// none of that to read a clock.
import { localClock } from "@/lib/scan/weekly/week";

export type { LocalClock } from "@/lib/scan/weekly/week";
export { localClock };

/** `draft/generate`'s gate: the site's own evening hour, every day. */
export function isDraftDue(instant: Date, timeZone: string): boolean {
  return localClock(instant, timeZone).hour === DRAFT_DUE_HOUR_LOCAL;
}

/** The site-local calendar date a draft generated now is for. Generation
 *  runs the evening before the publish date, so it is tomorrow's date in
 *  the site's own zone. */
export function nextPublishDate(instant: Date, timeZone: string): string {
  const tomorrow = new Date(instant.getTime() + 24 * 60 * 60 * 1000);
  return localClock(tomorrow, timeZone).date;
}
