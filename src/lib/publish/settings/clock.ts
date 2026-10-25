// BUILD §9 · REQ-073 c3 — the publish hour in the customer's own zone, the two ambiguous days a year included: the one
// implementation of "when does the next page go out", read by `becomesPublishable` and the calendar.
// No path falls back to the server's zone: no zone throws (REQ-073 c1), since the wrong zone is the wrong day.
// The ceilings' day and week boundaries are a different question, in `../ceilings/local-week.ts`.
import type { PublishingSettings } from "./settings";

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Local days the search may walk; a publish time occurs on every local day, so three is ample. */
const MAX_DAYS_FORWARD = 3;
/** How far a walk across a spring-forward gap may run; no IANA gap exceeds a couple of hours. */
const GAP_SEARCH_HOURS = 6;

/** The zone's offset in minutes at an instant, via `Intl`, the product's only zone source. */
function offsetMinutesAt(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Some runtimes render midnight as 24.
  const hour = read("hour") % 24;
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
  return (asUtc - instant.getTime()) / MS_PER_MINUTE;
}

/** The instant a wall time occurs in the zone, in two passes, or `null` inside a spring-forward gap, where the round
 *  trip never agrees. */
function instantOfWallTime(
  zone: string,
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number
): Date | null {
  const naive = Date.UTC(y, m, d, hh, mm, 0);
  let guess = new Date(naive - offsetMinutesAt(new Date(naive), zone) * MS_PER_MINUTE);
  guess = new Date(naive - offsetMinutesAt(guess, zone) * MS_PER_MINUTE);

  const back = offsetMinutesAt(guess, zone);
  const wall = guess.getTime() + back * MS_PER_MINUTE;
  return wall === naive ? guess : null;
}

/** The first instant the wall clock has reached `hh:mm` on the day: a skipped hour resolves to just after the gap.
 *  `wall(t)` is non-decreasing across a spring-forward, so overshoot once and walk back, both walks bounded. */
function firstInstantAfterGap(
  zone: string,
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number
): Date {
  const naive = Date.UTC(y, m, d, hh, mm, 0);
  const wallAt = (t: number): number => t + offsetMinutesAt(new Date(t), zone) * MS_PER_MINUTE;
  const bound = MINUTES_PER_HOUR * GAP_SEARCH_HOURS;

  let t = naive - offsetMinutesAt(new Date(naive), zone) * MS_PER_MINUTE;
  for (let step = 0; step < bound && wallAt(t) < naive; step++) t += MS_PER_MINUTE;
  for (let step = 0; step < bound && wallAt(t - MS_PER_MINUTE) >= naive; step++) t -= MS_PER_MINUTE;
  return new Date(t);
}

/** The local calendar date at an instant, in the zone. */
function localDate(instant: Date, zone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { y: read("year"), m: read("month") - 1, d: read("day") };
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
    const probe = new Date(instant.getTime() + dayOffset * MS_PER_DAY);
    const { y, m, d } = localDate(probe, zone);
    const exact = instantOfWallTime(zone, y, m, d, hh, mm);
    // `null` is the spring-forward gap.
    const candidate = exact ?? firstInstantAfterGap(zone, y, m, d, hh, mm);
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
  const zone = s.timezone;
  const { y, m, d } = localDate(nextPublishTimeAtOrAfter(instant, s), zone ?? "UTC");
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

function resolvable(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
