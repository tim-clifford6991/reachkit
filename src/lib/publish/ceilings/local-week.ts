// BUILD §9 — calendar boundaries in the customer's own zone.
//
// §9's ceilings are counted "in any calendar day" and "in any calendar
// week", and REQ-065's week starts on Monday. Both boundaries are the
// *customer's*, so this module answers every question of the site's own
// zone through `Intl.DateTimeFormat` — the platform's own IANA database,
// so no dependency and no offset table can go stale.
//
// This is a calendar boundary, not a publish time: `src/jobs/site-clock.ts`
// resolves the site-local *hour* a job is due, which is a different
// question, and the dependency direction is one-way (`src/jobs/` →
// `src/lib/`), so this module cannot call it. Both read the same
// `sites.timezone` through the same platform API, and a test asserts the
// two agree on a fixed date — the drift a second zone helper could
// otherwise hide.
import { WEEK_START } from "@/lib/config/constants";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const WEEKDAY_INDEX: Readonly<Record<string, number>> = Object.freeze({
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
});

/** `WEEK_START` is pinned as the word "monday"; the number is that same
 *  fact derived, never written twice. */
function weekStartIndex(): number {
  const word = WEEK_START;
  const key = word.slice(0, 1).toUpperCase() + word.slice(1, 3).toLowerCase();
  const index = WEEKDAY_INDEX[key];
  if (index === undefined) {
    throw new Error(`src/lib/publish/ceilings: "${word}" is not a weekday this module can read.`);
  }
  return index;
}

const WEEK_START_INDEX = weekStartIndex();

export interface LocalDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday: number;
}

/** Reads `instant` in `timeZone`. Throws on a zone the platform does not
 *  know rather than falling back to UTC — a site whose zone we cannot read
 *  is not a site whose calendar day we may guess at. */
export function localDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const at = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = WEEKDAY_INDEX[at("weekday")];
  if (weekday === undefined) {
    throw new Error(
      `src/lib/publish/ceilings: could not read a weekday in time zone "${timeZone}".`
    );
  }
  return {
    year: Number(at("year")),
    month: Number(at("month")),
    day: Number(at("day")),
    hour: Number(at("hour")) % 24,
    minute: Number(at("minute")),
    second: Number(at("second")),
    weekday,
  };
}

/** The zone's offset from UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const local = localDate(instant, timeZone);
  const asUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which a given local wall-clock midnight occurs.
 *
 *  Two passes, not one: the offset that turns a wall clock into an instant
 *  is itself a function of the instant, so the first pass uses the offset
 *  in force at the reference moment and the second uses the offset in force
 *  at the answer. That converges everywhere except the hour a zone skips
 *  over its own midnight, where it lands on the first instant that exists
 *  on the day — which is the boundary a customer in that zone would count
 *  from. */
function instantOfLocalMidnight(
  year: number,
  month: number,
  day: number,
  reference: Date,
  timeZone: string
): Date {
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0);
  let answer = new Date(wall - offsetMs(reference, timeZone));
  answer = new Date(wall - offsetMs(answer, timeZone));
  return answer;
}

/** The instant the customer's calendar day containing `instant` begins. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  const local = localDate(instant, timeZone);
  return instantOfLocalMidnight(local.year, local.month, local.day, instant, timeZone);
}

/** The instant the customer's next calendar day begins — a refusal's
 *  `nextFreeAt` when the day ceiling is what blocked. */
export function startOfNextLocalDay(instant: Date, timeZone: string): Date {
  const dayStart = startOfLocalDay(instant, timeZone);
  return startOfLocalDay(new Date(dayStart.getTime() + MS_PER_DAY + MS_PER_DAY / 2), timeZone);
}

/** The instant the customer's Monday-start calendar week containing
 *  `instant` begins. A page published on a Sunday counts in the week that
 *  Sunday *ends*, not the one it begins — which is the assertion a
 *  UTC-week implementation fails. */
export function startOfLocalWeek(instant: Date, timeZone: string): Date {
  const local = localDate(instant, timeZone);
  const daysBack = (local.weekday - WEEK_START_INDEX + 7) % 7;
  if (daysBack === 0) return startOfLocalDay(instant, timeZone);
  const back = new Date(startOfLocalDay(instant, timeZone).getTime() - daysBack * MS_PER_DAY + MS_PER_DAY / 2);
  return startOfLocalDay(back, timeZone);
}

/** The instant the customer's next Monday-start week begins. */
export function startOfNextLocalWeek(instant: Date, timeZone: string): Date {
  const weekStart = startOfLocalWeek(instant, timeZone);
  return startOfLocalWeek(new Date(weekStart.getTime() + 7 * MS_PER_DAY + MS_PER_DAY / 2), timeZone);
}
