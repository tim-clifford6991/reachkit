// BUILD §9 · REQ-073 c3 — the publish hour in the customer's own zone,
// including the two days a year it is ambiguous.
//
// This is the one implementation of "when does the next page go out" at the
// level of the hour. `becomesPublishable` calls it for its `at`; the
// calendar's next publication is composed from it. A second implementation
// would be the second copy that disagrees.
//
// **No code path falls back to the server's zone.** A settings object with
// no zone throws — REQ-073 c1 forbids a zone the customer never stated, and
// a page published at 09:00 in the wrong zone is a page published on the
// wrong day.
//
// The ceilings compute calendar day and week boundaries in the same zone.
// That is a different question and deliberately not this function.
//
// The archived plan is WO-219.
import type { PublishingSettings } from "./settings";

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** How many local days the search may walk before the zone is treated as
 *  unusable. Three is more than enough: a publish time occurs on every
 *  local day, gap or no gap. */
const MAX_DAYS_FORWARD = 3;
/** How far either walk across a spring-forward gap may run. No zone in the
 *  IANA database opens a gap wider than a couple of hours; six is slack,
 *  not a guess about a particular zone. */
const GAP_SEARCH_HOURS = 6;

/** The zone's offset from UTC, in minutes, at a given instant. Read from
 *  the runtime's own zone database through `Intl` — the only zone source in
 *  the product. */
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
  // `hour12: false` renders midnight as 24 in some runtimes; both spellings
  // mean the same instant.
  const hour = read("hour") % 24;
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
  return (asUtc - instant.getTime()) / MS_PER_MINUTE;
}

/** The instant at which the given wall time occurs in the zone, or `null`
 *  where that wall time does not occur at all (the spring-forward gap).
 *
 *  Two passes: guess with the offset in force at the naive instant, then
 *  re-read the offset at the guess and correct. The check at the end is
 *  what makes the gap detectable — a wall time inside the gap converts to
 *  an instant whose own wall time is a different hour, and no amount of
 *  correcting makes it agree. */
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

/** The first instant at which the zone's wall clock has reached `hh:mm` on
 *  the given local day — the answer for the spring-forward gap. A publish
 *  hour the clock skips resolves to the first instant after the gap, which
 *  is the earliest moment the customer's stated hour has passed.
 *
 *  `wall(t) = t + offset(t)` is non-decreasing across a spring-forward (the
 *  offset only grows), so the minimal `t` with `wall(t) >= naive` is found
 *  by overshooting once and then walking back to the boundary. Both walks
 *  are bounded: no zone in the database opens a gap wider than a few hours.
 */
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

/**
 * The first instant at or after `instant` at which the customer's publish
 * time occurs in the customer's zone. Inclusive at the boundary: asked at
 * exactly the publish time, it answers that instant, not tomorrow's.
 *
 * The two ambiguous days each have one stated answer:
 *
 *  - **Spring forward.** A publish time that does not exist resolves to the
 *    first instant after the gap. The alternative — skipping to the next
 *    day — would silently drop a publication once a year.
 *  - **Autumn back.** A publish time that occurs twice resolves to the
 *    first of the two. The page goes out at the customer's stated hour the
 *    first time that hour arrives; publishing at the second would hold it
 *    an extra hour for no reason the customer could see.
 *
 * Throws on a missing or unresolvable zone rather than defaulting. There is
 * no server-zone fallback anywhere in this file.
 */
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
    // `null` is the spring-forward gap: the stated wall time does not occur
    // on this local day, and the first instant after the gap is the answer.
    const candidate = exact ?? firstInstantAfterGap(zone, y, m, d, hh, mm);
    if (candidate.getTime() >= instant.getTime()) return candidate;
  }

  // Unreachable for any zone the runtime carries: three local days always
  // contain a publish time at or after the instant. Stated rather than
  // silently returning a wrong instant.
  throw new Error(
    `nextPublishTimeAtOrAfter: no publish time found within ${MAX_DAYS_FORWARD} days in zone "${zone}".`
  );
}

function resolvable(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
