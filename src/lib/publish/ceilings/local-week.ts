// BUILD §9 — calendar boundaries in the customer's own zone, for §9's "any calendar day" and "any calendar week"
// (REQ-065: weeks start Monday), via `Intl.DateTimeFormat`'s IANA data, so no offset table goes stale.
// Beside `src/lib/scan/weekly/week.ts` because the ceilings need the instants a local day and week begin at, which it
// does not export; a test holds the two to agree across DST transitions.
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

/** The number derived from the pinned `WEEK_START` word, never written twice. */
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

/** Reads `instant` in `timeZone`; throws on an unknown zone rather than guessing a calendar day in UTC. */
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

/** The instant of a local midnight, in two passes since the offset depends on the instant. Where a zone skips its
 *  midnight it lands on the day's first existing instant, which a customer there counts from. */
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

/** The instant the next local day begins: the day ceiling's `nextFreeAt`. */
export function startOfNextLocalDay(instant: Date, timeZone: string): Date {
  const dayStart = startOfLocalDay(instant, timeZone);
  return startOfLocalDay(new Date(dayStart.getTime() + MS_PER_DAY + MS_PER_DAY / 2), timeZone);
}

/** The instant the local Monday-start week begins; a Sunday counts in the week it ends. */
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
