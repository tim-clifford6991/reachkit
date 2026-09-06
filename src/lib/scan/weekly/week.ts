// BUILD §11 — the site-local week: where it starts, what it is keyed by,
// and when the next measurement is due.
//
// ADR-060, verbatim: "Weekly measurement is triggered hourly and gated on
// each site's own local Monday; 'Mon 06:00 UTC' is not the trigger." This
// file is the calendar half of that ruling and holds no schedule, no query
// and no I/O: every question is asked of the site's own zone through
// `Intl.DateTimeFormat`, which is the platform's own IANA database, so no
// dependency and no table of offsets can go stale here.
//
// **A week is a calendar date, never an instant.** `weekStartFor` returns
// `YYYY-MM-DD` — the site-local Monday — because that is what is written
// to `scans.week_start` at insert and never recomputed on read. An instant
// would re-invite recomputation at every render, and a customer who moves
// their zone would watch an already-measured week slide into its
// neighbour: the label a measurement was stamped with must survive a zone
// change, and a stored calendar date does.
//
// Nothing here reads UTC to decide anything. A site west of UTC−6 is still
// in its previous week at 06:00 UTC on Monday, which is the whole of
// ADR-060's reasoning and the mutation the tests fail on.
//
// `localClock` lives here rather than in `src/jobs/` because the job
// runner may import the engine and the engine may not import the job
// runner (ARCHITECTURE rule 2). `src/jobs/site-clock.ts` reads it from
// here, so `draft/generate`'s evening and this Monday are one derivation
// and not two.
import { WEEK_START, WEEKLY_DUE_HOUR_LOCAL } from "@/lib/config/constants";

/** A wall-clock reading in one site's zone. */
export interface LocalClock {
  /** ISO weekday, 1 = Monday … 7 = Sunday. */
  readonly weekday: number;
  /** 0–23. */
  readonly hour: number;
  /** The local calendar date, `YYYY-MM-DD`. */
  readonly date: string;
}

/** One site's own clock, as everything below asks for it. */
export interface SiteZone {
  readonly at: Date;
  readonly zone: string;
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = Object.freeze({
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
});

/** `WEEK_START` is pinned as the word "monday"; this is the same fact as a
 *  weekday number, derived rather than written twice. A pin this module
 *  cannot read is a boot failure, not a silent fallback to Monday. */
function weekdayIndexOf(word: string): number {
  const key = word.slice(0, 1).toUpperCase() + word.slice(1, 3).toLowerCase();
  const index = WEEKDAY_INDEX[key];
  if (index === undefined) {
    throw new Error(`src/lib/scan/weekly/week.ts: "${word}" is not a weekday this module can read.`);
  }
  return index;
}

const WEEK_START_INDEX = weekdayIndexOf(WEEK_START);

const CLOCK_PARTS = { weekday: "short", hour: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" } as const;
const OFFSET_PARTS = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } as const;

// Constructing an `Intl.DateTimeFormat` is the expensive half of reading a
// clock, and the weekly tick reads one per site — twice over, walking back
// to a Monday. Two formatters per zone, kept: the zone set is the
// customers' own and is small, and a formatter holds no instant, so it is
// safe to reuse across every reading.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string, parts: Intl.DateTimeFormatOptions, tag: string): Intl.DateTimeFormat {
  const key = `${tag}|${zone}`;
  const held = formatters.get(key);
  if (held !== undefined) return held;
  const made = new Intl.DateTimeFormat("en-US", { timeZone: zone, ...parts });
  formatters.set(key, made);
  return made;
}

/** Reads `instant` in `zone`. Throws on a zone we cannot read rather than
 *  silently falling back to UTC — a site whose zone we cannot read is not
 *  a site we may measure on the wrong day. */
export function localClock(instant: Date, zone: string): LocalClock {
  const parts = formatter(zone, CLOCK_PARTS, "clock").formatToParts(instant);

  const at = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = WEEKDAY_INDEX[at("weekday")];
  if (weekday === undefined) {
    throw new Error(`src/lib/scan/weekly/week.ts: could not read a weekday in time zone "${zone}".`);
  }
  // `hour12: false` renders midnight as "24" in some locales; normalise it.
  return { weekday, hour: Number(at("hour")) % 24, date: `${at("year")}-${at("month")}-${at("day")}` };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The site-local week the instant belongs to, as the calendar date of its
 * Monday. This is `scans.week_start`, and the second half of the
 * `(site_id, week_start)` key the database enforces.
 *
 * Stepping back a whole day at a time and re-reading the clock is what
 * makes this right across a DST transition and across a zone whose offset
 * is not a whole hour: the arithmetic is never done on the local date
 * string, only on instants, and every reading is the platform's own.
 */
export function weekStartFor(a: SiteZone): string {
  const local = localClock(a.at, a.zone);
  const daysBack = (local.weekday - WEEK_START_INDEX + 7) % 7;
  if (daysBack === 0) return local.date;
  // Midday, so a day whose offset shifts by an hour cannot land the step
  // on the previous or next date.
  let cursor = a.at.getTime() - daysBack * MS_PER_DAY;
  for (let guard = 0; guard < 3; guard += 1) {
    const stepped = localClock(new Date(cursor), a.zone);
    if (stepped.weekday === WEEK_START_INDEX) return stepped.date;
    cursor -= ((stepped.weekday - WEEK_START_INDEX + 7) % 7) * MS_PER_DAY;
  }
  throw new Error(`src/lib/scan/weekly/week.ts: could not find the week start in time zone "${a.zone}".`);
}

/** The idempotency key of one site's week — the pair the partial unique
 *  index on `scans` makes unrepresentable twice, written once here so no
 *  caller composes its own spelling of it. */
export function weekKey(a: { siteId: string; weekStart: string }): string {
  return `${a.siteId}:${a.weekStart}`;
}

/** ADR-060's gate: the site's own Monday, at the site's own due hour. A
 *  tick lands once an hour, so "due" is a window one hour wide in the
 *  site's own clock — two ticks inside it cannot happen. */
export function isWeeklyDue(a: SiteZone): boolean {
  const local = localClock(a.at, a.zone);
  return local.weekday === WEEK_START_INDEX && local.hour === WEEKLY_DUE_HOUR_LOCAL;
}

/**
 * The offset `zone` was at, at `instant`, in milliseconds.
 *
 * `formatToParts` gives the wall-clock reading in the zone; treating that
 * reading as if it were UTC and subtracting the instant is the offset. It
 * is the platform's own answer for that instant, so it is right on both
 * sides of a DST transition and in a zone offset by 45 minutes.
 */
function offsetMs(instant: Date, zone: string): number {
  const parts = formatter(zone, OFFSET_PARTS, "offset").formatToParts(instant);
  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(at("year"), at("month") - 1, at("day"), at("hour") % 24, at("minute"), at("second"));
  // Every IANA offset is a whole number of minutes, so rounding to the
  // minute drops the sub-second the formatter truncated and adds nothing.
  return Math.round((asUtc - instant.getTime()) / 60_000) * 60_000;
}

/**
 * The instant at which a local date reads `hour:00` in `zone`.
 *
 * Two passes: guess by treating the wall clock as UTC, correct by the
 * offset that guess falls in, then correct again by the offset the
 * corrected instant falls in. The second pass is what handles a target
 * that lands on the far side of a transition from its own guess.
 */
function instantOfLocal(a: { date: string; hour: number; zone: string }): Date {
  const [year, month, day] = a.date.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(year, month - 1, day, a.hour);
  let instant = wall - offsetMs(new Date(wall), a.zone);
  instant = wall - offsetMs(new Date(instant), a.zone);
  return new Date(instant);
}

/**
 * The next moment a weekly measurement is due for this zone: the site's
 * own Monday at `WEEKLY_DUE_HOUR_LOCAL`, this week if that hour has not
 * yet passed and next week otherwise.
 *
 * It names a *scheduled* measurement and nothing else. A week whose run
 * failed is retried on the very next hourly tick inside that same week
 * (`dueSites`), but a retry is not a promise, and this is the one date the
 * shell, Overview and the weekly mail all state — so they cannot state two
 * different ones (rule 7.1).
 */
export function nextDueAfter(a: SiteZone): Date {
  const thisWeek = instantOfLocal({ date: weekStartFor(a), hour: WEEKLY_DUE_HOUR_LOCAL, zone: a.zone });
  if (thisWeek.getTime() > a.at.getTime()) return thisWeek;
  // Walking forward a week at a time and re-reading the clock, rather than
  // adding seven days once: a transition that shortens a week by an hour
  // can put `at + 7d` back inside the week it started in, and a "next
  // measurement" in the past is the one answer this may never give.
  for (let week = 1; week <= 2; week += 1) {
    const start = weekStartFor({ at: new Date(a.at.getTime() + week * 7 * MS_PER_DAY), zone: a.zone });
    const due = instantOfLocal({ date: start, hour: WEEKLY_DUE_HOUR_LOCAL, zone: a.zone });
    if (due.getTime() > a.at.getTime()) return due;
  }
  throw new Error(`src/lib/scan/weekly/week.ts: could not find the next due instant in time zone "${a.zone}".`);
}
