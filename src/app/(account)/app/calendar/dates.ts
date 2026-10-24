// BUILD §4.6 — "Mon–Sun columns … weekends included."
//
// Every date this screen states is a **site-local calendar day**, not an
// instant: REQ-073 c1 stores the customer's zone once, and REQ-043's own
// `rests-on` row says why it matters — "a calendar day begins and ends in
// the customer's own local day, not the server's". A customer in UTC+13
// opening at 01:00 local must see their own today, not the server's
// yesterday.
//
// A day is therefore carried as a `DayKey` — the `YYYY-MM-DD` the site's
// zone was showing — and never as a `Date`. Two consequences the rest of
// the module leans on: day arithmetic is calendar arithmetic with no DST
// hazard at all, and two days are the same day exactly when their strings
// are equal.
//
// **Locale.** `../_shell/format.ts` already chose `en-US`, once, and gave
// its reason (DECISIONS 2026-08-28: "MVP is US-English only: one
// `SERP_LOCATION` constant"; `Intl` needs the BCP-47 spelling of that
// pair). This file reuses that choice rather than minting a second one, and
// the `DayKey` itself is assembled from `formatToParts` so the key's own
// shape is locale-independent whatever that choice later becomes.
import { SHELL_LOCALE } from "../_shell/format";

/** A site-local calendar day, `YYYY-MM-DD`. */
export type DayKey = string;
/** A site-local calendar month, `YYYY-MM`. */
export type MonthKey = string;

const KEY_PARTS = { year: "numeric", month: "2-digit", day: "2-digit" } as const;

/** The site-local day an instant falls on. */
export function dayKeyOf(at: Date, timeZone: string): DayKey {
  const parts = new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, ...KEY_PARTS }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

/** The `Date` a `DayKey` names, at UTC midnight. Used only for weekday and
 *  calendar arithmetic and for handing `Intl` something to format — never
 *  as an instant in the customer's zone, which is why every formatter below
 *  passes `timeZone: "UTC"` against it. */
function utcOf(day: DayKey): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

function keyOfUtc(at: Date): DayKey {
  return at.toISOString().slice(0, 10);
}

/** Monday is column 0. §4.6 says "Mon–Sun", and `Date`'s own week starts on
 *  Sunday — the shift is here, once, rather than in the grid. */
export function weekdayIndex(day: DayKey): number {
  return (utcOf(day).getUTCDay() + 6) % 7;
}

export function addDays(day: DayKey, delta: number): DayKey {
  const at = utcOf(day);
  at.setUTCDate(at.getUTCDate() + delta);
  return keyOfUtc(at);
}

/**
 * The last date the plan reaches (SPEC §7, 2026-10-15, issue 1455): six
 * days after today, so the next seven days always carry their planned page.
 * It replaces issue 857's Sunday before the next weekly pass, which on a
 * Saturday planned two days. A date after that pass is planned from the
 * ranking that stands today, and the pass may plan it again. `today` is
 * already site-local.
 */
export function planHorizonEnd(today: DayKey): DayKey {
  return addDays(today, 6);
}

/** Plan's week (SPEC §7, E5): Monday to Sunday of the site-local week that
 *  contains today, seven dates. */
export function planWeek(today: DayKey): readonly DayKey[] {
  const monday = addDays(today, -weekdayIndex(today));
  return Array.from({ length: 7 }, (_, at) => addDays(monday, at));
}

/** Every date in a month, in order. */
export function daysOfMonth(month: MonthKey): readonly DayKey[] {
  const first = `${month}-01`;
  const days: DayKey[] = [];
  for (let day = first; monthOf(day) === month; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * The cells of a Mon–Sun month grid: the month's own days, preceded and
 * followed by whatever it takes to fill the first and last weeks.
 *
 * A leading or trailing cell exists **to hold a column position** and holds
 * nothing else — it is not a date the calendar has anything to say about,
 * and it is emphatically not padding (§4.6: "the calendar is never
 * padded"). `inMonth` is what tells the two apart, and the grid renders no
 * content for a cell that is `false`.
 */
export function monthGrid(month: MonthKey): readonly { day: DayKey; inMonth: boolean }[] {
  const days = daysOfMonth(month);
  const first = days[0] ?? `${month}-01`;
  const last = days[days.length - 1] ?? first;

  const cells: { day: DayKey; inMonth: boolean }[] = [];
  for (let i = weekdayIndex(first); i > 0; i--) {
    cells.push({ day: addDays(first, -i), inMonth: false });
  }
  for (const day of days) cells.push({ day, inMonth: true });
  for (let i = 1; i <= 6 - weekdayIndex(last); i++) {
    cells.push({ day: addDays(last, i), inMonth: false });
  }
  return cells;
}

// ── Rendered values ──────────────────────────────────────────────────────
// Every one of these is a *value*, not a sentence: §2.3's numeral rule
// covers them and the copy registry does not (`tests/presentation/copy`
// sweeps sentences, and a formatted date is not one).

/** The date numeral a grid cell carries. */
export function dayNumber(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", day: "numeric" }).format(utcOf(day));
}

/** The date the day panel heads with. */
export function fullDate(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(utcOf(day));
}

/** A known Monday — the one date in this file that is written down. Every
 *  weekday name the screen speaks is formatted from it, so "Mon–Sun" and
 *  the weekly pass's own day are one fact rather than several strings. */
const MONDAY: DayKey = "2026-09-07";

/** The date a day card and a day of the phone list name, in words — "8
 *  September". The card itself draws the numeral alone; this is the form
 *  its label speaks, where "8" on its own would say nothing (issue 930). */
export function cardDate(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(utcOf(day));
}

/** The weekday a date falls on, short — the phone list's left column
 *  (issue 930). Read from the date rather than from a list of seven
 *  strings. */
export function weekdayShort(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "short" }).format(
    utcOf(day)
  );
}

/**
 * The word a live page's card carries where this week's pass has not
 * measured a place for it yet — the name of the day it will be: "Mon"
 * (SPEC §7, 2026-09-20; issue 930).
 *
 * It is the **weekday's own name**, taken from a known Monday and not
 * written down: "Mon–Sun" is one fact and
 * not seven strings, and the day the weekly pass runs on is the same
 * Monday §7's plan horizon is cut at. So it is a value, like a date
 * numeral, rather than a sentence the registry owes.
 */
export function firstMeasuredLabel(): string {
  return weekdayShort(MONDAY);
}


/** A date with its weekday in words, the head's "Chosen …" and the
 *  next-Monday line. */
export function longDate(day: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(utcOf(day));
}

/** The week card's heading: its first and last day as one range. */
export function weekRange(first: DayKey, last: DayKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "short", month: "long", day: "numeric" }).formatRange(
    utcOf(first),
    utcOf(last)
  );
}

// The Monday mail's greeting counts weeks by the same rule.
export { serviceWeek } from "@/lib/opportunities/days";

/** A stored `HH:mm` publish time as the shell's clock writes it: "4:00 PM". */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(
    new Date(Date.UTC(2026, 0, 1, h ?? 0, m ?? 0))
  );
}
