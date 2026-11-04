// BUILD §11 — the site-local week: where it starts, what it is keyed by,
// and when the next measurement is due.
//
// ADR-060, verbatim: "Weekly measurement is triggered hourly and gated on
// each site's own local Monday; 'Mon 06:00 UTC' is not the trigger." This
// file is the calendar half of that ruling and holds no schedule, no query
// and no I/O: every question is asked of the site's own zone through
// `@date-fns/tz`, which reads the platform's own IANA database, so no
// table of offsets can go stale here.
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
import { TZDate } from "@date-fns/tz";
import { addWeeks, format, getISODay, setHours, startOfWeek, type Day } from "date-fns";
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

/** `WEEK_START` as date-fns counts weekdays, derived from the pin rather than written twice. */
export const WEEK_STARTS_ON = (
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
).indexOf(WEEK_START) as Day;

/** `instant` as a date in `zone`. Throws on a zone we cannot read rather
 *  than silently falling back to UTC — a site whose zone we cannot read is
 *  not a site we may measure on the wrong day. */
export function inZone(instant: Date | number, zone: string): TZDate {
  const local = new TZDate(+instant, zone);
  if (Number.isNaN(local.getTime())) {
    throw new Error(`src/lib/scan/weekly/week.ts: could not read time zone "${zone}".`);
  }
  return local;
}

/** Reads `instant` in `zone`. */
export function localClock(instant: Date, zone: string): LocalClock {
  const local = inZone(instant, zone);
  return { weekday: getISODay(local), hour: local.getHours(), date: format(local, "yyyy-MM-dd") };
}

/** The local midnight a site's week begins at. */
function weekStartOf(a: SiteZone): TZDate {
  return startOfWeek(inZone(a.at, a.zone), { weekStartsOn: WEEK_STARTS_ON });
}

/**
 * The site-local week the instant belongs to, as the calendar date of its
 * Monday. This is `scans.week_start`, and the second half of the
 * `(site_id, week_start)` key the database enforces.
 */
export function weekStartFor(a: SiteZone): string {
  return format(weekStartOf(a), "yyyy-MM-dd");
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
  return local.date === weekStartFor(a) && local.hour === WEEKLY_DUE_HOUR_LOCAL;
}

/** The site's own week has begun once its Monday due hour has arrived, and stays begun until the next Monday. */
export function weekHasBegun(a: SiteZone): boolean {
  const local = localClock(a.at, a.zone);
  const start = weekStartFor(a);
  return local.date > start || (local.date === start && local.hour >= WEEKLY_DUE_HOUR_LOCAL);
}

/** The instant a site's week began: its own Monday at 00:00 (issue 1170).
 *  A weekly pass is served nothing read before it. */
export function weekStartInstant(a: { weekStart: string; zone: string }): Date {
  const [year, month, day] = a.weekStart.split("-").map(Number) as [number, number, number];
  return new Date(+new TZDate(year, month - 1, day, a.zone));
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
  const monday = weekStartOf(a);
  const thisWeek = setHours(monday, WEEKLY_DUE_HOUR_LOCAL);
  const due = thisWeek.getTime() > a.at.getTime() ? thisWeek : setHours(addWeeks(monday, 1), WEEKLY_DUE_HOUR_LOCAL);
  return new Date(+due);
}
