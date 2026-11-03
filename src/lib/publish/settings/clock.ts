// BUILD §9 · REQ-073 c3 — the publish hour in the customer's own zone, the two ambiguous days a year included: the one
// implementation of "when does the next page go out", read by `becomesPublishable` and the calendar.
// No path falls back to the server's zone: no zone throws (REQ-073 c1), since the wrong zone is the wrong day.
import { TZDate, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";
import { inZone } from "@/lib/scan/weekly/week";
import type { PublishingSettings } from "./settings";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Local days the search may walk; a publish time occurs on every local day, so three is ample. */
const MAX_DAYS_FORWARD = 3;
/** How far either side of a spring-forward gap the search reaches; no IANA gap exceeds a couple of hours. */
const GAP_SEARCH_MS = 6 * 60 * MS_PER_MINUTE;

/** The instant `hh:mm` occurs on a local day. A time that occurs twice is the first; a time a spring-forward skips is
 *  the first instant the clock has passed it, found by halving since the wall clock only moves forward near a gap. */
function instantOfWallTime(zone: string, day: TZDate, hh: number, mm: number): Date {
  const at = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm, zone);
  if (at.getHours() === hh && at.getMinutes() === mm) return new Date(+at);

  const naive = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
  const wallAt = (t: number): number => t + tzOffset(zone, new Date(t)) * MS_PER_MINUTE;
  let before = +at - GAP_SEARCH_MS;
  let after = +at + GAP_SEARCH_MS;
  while (after - before > MS_PER_MINUTE) {
    const mid = before + Math.floor((after - before) / 2 / MS_PER_MINUTE) * MS_PER_MINUTE;
    if (wallAt(mid) >= naive) after = mid;
    else before = mid;
  }
  return new Date(after);
}

/** The first publish time at or after `instant` in the customer's zone, inclusive at the boundary.
 *  - Spring forward: a time that does not exist resolves to just after the gap, never the next day's.
 *  - Autumn back: a time that occurs twice resolves to the first.
 *  Throws on a missing or unresolvable zone; there is no server-zone fallback. */
export function nextPublishTimeAtOrAfter(instant: Date, s: PublishingSettings): Date {
  const zone = s.timezone;
  if (zone === null || !resolvable(zone)) {
    throw new Error(
      "nextPublishTimeAtOrAfter: the site has no resolvable time zone; there is no fallback."
    );
  }

  const [hhText = "", mmText = ""] = s.publishTime.split(":");
  const hh = Number(hhText);
  const mm = Number(mmText);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) {
    throw new Error(`nextPublishTimeAtOrAfter: publishTime "${s.publishTime}" is not HH:mm.`);
  }

  for (let dayOffset = 0; dayOffset <= MAX_DAYS_FORWARD; dayOffset++) {
    const candidate = instantOfWallTime(zone, inZone(instant.getTime() + dayOffset * MS_PER_DAY, zone), hh, mm);
    if (candidate.getTime() >= instant.getTime()) return candidate;
  }

  // Unreachable for any zone the runtime carries; thrown rather than a wrong instant.
  throw new Error(
    `nextPublishTimeAtOrAfter: no publish time found within ${MAX_DAYS_FORWARD} days in zone "${zone}".`
  );
}

/** The site-local date of the first publish time at or after `instant`. Asked with a window's end, it is the only date
 *  the row, calendar and mail may name, and the draft tick and `enterReview` both ask here. */
export function publishDateAtOrAfter(instant: Date, s: PublishingSettings): string {
  return format(inZone(nextPublishTimeAtOrAfter(instant, s), s.timezone ?? "UTC"), "yyyy-MM-dd");
}

function resolvable(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
