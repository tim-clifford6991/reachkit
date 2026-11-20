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
import { localDay, weekStartFor } from "@/lib/scan/weekly/week";

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
  /** SPEC §4 (2026-09-20): the one word the day carries — the stage of the
   *  page scheduled for it (`calendar.stage.*`, the calendar's own five) or
   *  `NO_PAGE_KEY` where nothing is scheduled. Never absent: a cell with no
   *  word would be a cell whose meaning is its colour, which §2.5 forbids. */
  pageKey: CopyKey;
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
  /** The searches this week's pages are aimed at (issue 867) — the pages
   *  themselves, never a count. Empty where the week has none planned or
   *  written, and the module then states no aim. */
  searches?: readonly string[];
  /** §4.5's "Open calendar →" — the one control this module carries. */
  calendarHref: string;
}

/** What a day with nothing scheduled on it says. A day is never blank: the
 *  strip states what stands on every one of the seven. */
export const NO_PAGE_KEY = "overview.week.day.no-page" satisfies CopyKey;

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
 *  applied when the day was resolved (`readWeek`); reading the marker
 *  is a second, different operation, and doing it in the site's zone would
 *  apply the offset twice. */
export const CALENDAR_DAY_ZONE = "UTC";

const MS_PER_DAY = 86_400_000;

export function readWeek(input: {
  today: Date;
  timeZone: string;
  /** The stage word for each of the seven days, in the strip's own order
   *  (the week's first day first). `null` — or an absent entry — is a day
   *  with no page on it. Supplied by the reader that holds the site's
   *  drafts; this module decides nothing about what is scheduled. */
  pages?: readonly (CopyKey | null)[];
}): WeekModule {
  // Each day is carried as its site-local date at UTC midnight, where "the same day" is an equality.
  const today = new Date(`${localDay(input.today, input.timeZone)}T00:00:00Z`);
  const start = new Date(`${weekStartFor({ at: input.today, zone: input.timeZone })}T00:00:00Z`);

  const dayAt = (offset: number): WeekDayModel => {
    const date = new Date(start.getTime() + offset * MS_PER_DAY);
    const state: DayState =
      date.getTime() < today.getTime()
        ? "done"
        : date.getTime() === today.getTime()
          ? "today"
          : "to-come";
    return {
      date,
      state,
      markKey: DAY_MARK[state],
      pageKey: input.pages?.[offset] ?? NO_PAGE_KEY,
    };
  };

  // Written out rather than generated: the tuple type is the seven, and a
  // generated array would need a cast to become one — which is exactly the
  // cast that would let a six-day strip through.
  const days: SevenDayModel = [dayAt(0), dayAt(1), dayAt(2), dayAt(3), dayAt(4), dayAt(5), dayAt(6)];

  return { days, calendarHref: CALENDAR_HREF };
}
