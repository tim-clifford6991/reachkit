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

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const at = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1));
  return keyOfUtc(at).slice(0, 7);
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

/** The month a switcher control names — which is also that control's whole
 *  label, so the switcher needs no sentence of its own. */
export function monthLabel(month: MonthKey): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(utcOf(`${month}-01`));
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

/** The seven column heads, Monday first. Taken from a known Monday rather
 *  than written down, so "Mon–Sun" is one fact and not seven strings. */
export function weekdayLabels(): readonly string[] {
  // 2026-09-07 is a Monday.
  const monday: DayKey = "2026-09-07";
  const format = new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", weekday: "short" });
  return Array.from({ length: 7 }, (_, i) => format.format(utcOf(addDays(monday, i))));
}
