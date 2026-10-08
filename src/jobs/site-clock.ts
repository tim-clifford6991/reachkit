// src/jobs/site-clock.ts — BUILD §11
//
// ADR-060, verbatim: "Weekly measurement is triggered hourly and gated on
// each site's own local Monday; 'Mon 06:00 UTC' is not the trigger." The
// same shape serves `draft/generate`, and this file is that half: the
// daily gate and the date a draft written now is for.
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
// **The due hour is each site's own** (SPEC §7, 2026-10-08, issue 1337).
// A page publishes at the first publish time at or after its veto window
// ends, so a page written at one fixed hour of the day went out a day
// after the date it was written for whenever that hour plus the window
// fell after the morning's publish time — which, at 18:00 and 24 hours,
// was every day. The page for date D is written in the hour whose own
// start plus the window is at or before D's publish time, and less than an
// hour before it. The window is counted from the start of that hour, so it
// ends at or before the publish time however late the tick is delivered.
//
// A tick lands once an hour, so "due" means "this is the site's due hour".
// Two ticks inside one such hour cannot happen; a tick the platform missed
// is a run the site does not get that day, which the engine's own
// constraint tolerates.
// The leaf, not the module's index: the index reaches the database, and
// the gate needs none of that to read a clock.
import { nextPublishTimeAtOrAfter, publishDateAtOrAfter } from "@/lib/publish/settings/clock";
// The leaf here too: the index also carries the selection and the
// measurement.
import { localClock } from "@/lib/scan/weekly/week";

export type { LocalClock } from "@/lib/scan/weekly/week";
export { localClock };

const MS_PER_HOUR = 3_600_000;

/** What a site's due hour and publish date are decided from. */
export interface DraftClock {
  readonly timeZone: string;
  /** `HH:mm`, read in `timeZone`. */
  readonly publishTime: string;
  readonly vetoHours: number;
}

/** The hour a tick belongs to. The window a tick opens is counted from
 *  here, not from the second the platform delivered it. */
export function tickHour(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / MS_PER_HOUR) * MS_PER_HOUR);
}

/** The moment a veto window opened at `instant` ends. */
function windowEnd(instant: Date, site: DraftClock): Date {
  return new Date(instant.getTime() + site.vetoHours * MS_PER_HOUR);
}

function settingsOf(site: DraftClock) {
  return { mode: "autopilot" as const, vetoHours: site.vetoHours, publishTime: site.publishTime, timezone: site.timeZone };
}

/** `draft/generate`'s gate: the one hour a day whose window ends at the
 *  site's publish time, or less than an hour before it. */
export function isDraftDue(tick: Date, site: DraftClock): boolean {
  const ends = windowEnd(tickHour(tick), site);
  return nextPublishTimeAtOrAfter(ends, settingsOf(site)).getTime() - ends.getTime() < MS_PER_HOUR;
}

/** The site-local calendar date a draft whose window opens at `instant`
 *  is for: the day it publishes on if nobody touches it. In the due hour
 *  that is the date the hour was due for; at any other moment (a first
 *  draft, a setting just changed) it is the first date whose publish time
 *  is at least the window away. */
export function nextPublishDate(instant: Date, site: DraftClock): string {
  return publishDateAtOrAfter(windowEnd(instant, site), settingsOf(site));
}
