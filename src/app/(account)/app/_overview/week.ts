// BUILD §4.5 — the seven days of this week: done, today, still to come.
//
// §4.5 item 5, verbatim: "**This week**: 7-day strip (done/today/next) +
// 'Open calendar →'". REQ-041 c6 states the same thing as a promise: the
// customer "can see which days of this week are done, which is today, and
// which are still to come".
//
// **Three states, and the customer's own zone decides them.** "Today" is
// today where the customer is (REQ-073 c1's one stored preference), not
// where the server is: a customer in a US zone opening the screen late on a
// Sunday evening UTC-time is still on Sunday, and a strip that marked
// Monday as today would be telling them the week had turned when it had
// not. Every comparison below is made on the site-local calendar date,
// which is why the zone is a parameter and not read from the runtime.
//
// **Seven days, by type.** The week is built as a fixed-length tuple, so a
// strip missing a day has no shape to be in.
import type { CopyKey } from "@/lib/presentation/copy";
import { WEEK_START } from "@/lib/config/constants";

export type DayState = "done" | "today" | "to-come";

export interface WeekDayModel {
  /** The site-local calendar day this cell is, carried as that day at UTC
   *  midnight. It is a **calendar day marker, not an instant**: the day was
   *  already resolved in the site's zone here, so a renderer that formatted
   *  it in the site's zone again would shift it back across midnight and
   *  label Monday's cell "Sunday". Renderers format it with
   *  `CALENDAR_DAY_ZONE`. */
  date: Date;
  state: DayState;
  markKey: CopyKey;
}

export type SevenDayModel = readonly [
  WeekDayModel,
  WeekDayModel,
  WeekDayModel,
  WeekDayModel,
  WeekDayModel,
  WeekDayModel,
  WeekDayModel,
];

export interface WeekModule {
  days: SevenDayModel;
  /** §4.5's "Open calendar →" — the one control this module carries. */
  calendarHref: string;
}

export const DAY_MARK: Readonly<Record<DayState, CopyKey>> = Object.freeze({
  done: "overview.week.day.done",
  today: "overview.week.day.today",
  "to-come": "overview.week.day.to-come",
});

/** The one destination this module links to. §4.4 closes the app's
 *  navigation ("No other navigation"), so this is the calendar's own route
 *  and nothing else. */
export const CALENDAR_HREF = "/app/calendar";

/** The zone a `WeekDayModel.date` is read back in. The site's own zone was
 *  applied when the day was resolved (`localMidnight`); reading the marker
 *  is a second, different operation, and doing it in the site's zone would
 *  apply the offset twice. */
export const CALENDAR_DAY_ZONE = "UTC";

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 86_400_000;

export function readWeek(input: { today: Date; timeZone: string }): WeekModule {
  const today = localMidnight(input.today, input.timeZone);
  const start = weekStartOf(today);

  const dayAt = (offset: number): WeekDayModel => {
    const date = new Date(start.getTime() + offset * MS_PER_DAY);
    const state: DayState =
      date.getTime() < today.getTime()
        ? "done"
        : date.getTime() === today.getTime()
          ? "today"
          : "to-come";
    return { date, state, markKey: DAY_MARK[state] };
  };

  // Written out rather than generated: the tuple type is the seven, and a
  // generated array would need a cast to become one — which is exactly the
  // cast that would let a six-day strip through.
  const days: SevenDayModel = [dayAt(0), dayAt(1), dayAt(2), dayAt(3), dayAt(4), dayAt(5), dayAt(6)];

  return { days, calendarHref: CALENDAR_HREF };
}

/** The site-local calendar day of `at`, as a UTC-midnight instant — the one
 *  representation in which "the same day" is an equality rather than a
 *  range. `en-CA` is chosen here for its ISO-shaped output (`2026-09-05`),
 *  a parse target and not a customer-visible locale; every string the
 *  customer reads is formatted by the shell's own `formatDate`. */
function localMidnight(at: Date, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(at)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** `getUTCDay()`'s index for each week start the pin can name. Keyed by
 *  `typeof WEEK_START`, so changing the pin (REQ-065 c1) is a compile error
 *  here — a missing row — rather than a strip that silently starts on the
 *  wrong day. */
const WEEK_START_INDEX: Readonly<Record<typeof WEEK_START, number>> = Object.freeze({ monday: 1 });

/** The first day of `day`'s own week. */
function weekStartOf(day: Date): Date {
  const fromStart =
    (day.getUTCDay() - WEEK_START_INDEX[WEEK_START] + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  return new Date(day.getTime() - fromStart * MS_PER_DAY);
}
