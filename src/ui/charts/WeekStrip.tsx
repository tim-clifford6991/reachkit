// BUILD §2.4 — the seven-day week strip · UI-SPEC §2 WeekStrip (`.week .day`)
//
// §4.5 module 5: "7-day strip (done/today/next)". The approved set draws it
// as seven flat cells (set L216–225, L531; issue #521): the day of the month
// in mono on `--sunk`, and under it a short coloured rule — `--ok` for a day
// done, `--warn` for a day with nothing measured, `--accent` (and the accent
// tint) for today, and a quiet cell for a day still to come.
//
// **HTML, not an SVG — the one chart in the inventory that is.** The strip is
// the full width of its card at every band, and its numerals are the type
// ladder's `--t-sm` at every band. A hand-sized viewBox can hold one of those
// and not both: stretched across a 970px card its text is drawn at three
// times the size, squeezed into a 256px one it is unreadable. Seven grid
// cells hold both, which is how the set draws it. Its stylesheet is
// `week-strip.css`, which §2.2's "chart SVGs" clause admits by directory
// (`component-registry.test.ts`'s glob) and this file imports, the way
// `CalendarGrid` imports its own.
//
// **Identity is never colour alone (§2.4).** The set draws no word in the
// cell, and neither does this: each day's written word for its state is its
// accessible text (`sr-only`), read with its date, and the pair is the cell's
// hover title. With the colours removed a reader still hears "31 done".
//
// The colours are §2.4's own exception — "status colors (ok/warn/bad) are for
// state, never for series" — and a day's state is exactly a state. No series
// is drawn here.
//
// **Seven days can never become six.** `days` is a seven-tuple, so a strip
// with a day dropped out of it has no call shape.
import type React from "react";
import "./week-strip.css";

/** What the day is. Four states; the set's `unmeasured` is
 *  `nothing-measured`. */
export type WeekDayState = "done" | "today" | "to-come" | "nothing-measured";

export interface WeekDay {
  /** The date, as the caller's own time zone renders it. */
  readonly date: string;
  readonly state: WeekDayState;
  /** The written word for the state — the caller's, from the copy
   *  registry. No component in this directory owns a string. */
  readonly mark: string;
}

/** Seven, by type. */
export type SevenDays = readonly [WeekDay, WeekDay, WeekDay, WeekDay, WeekDay, WeekDay, WeekDay];

export function WeekStrip(p: { days: SevenDays; label: string }): React.JSX.Element {
  return (
    <ol className="rk-week" aria-label={p.label}>
      {p.days.map((day) => (
        <li
          key={`day-${day.date}`}
          className="rk-week-day"
          data-state={day.state}
          title={`${day.date} · ${day.mark}`}
        >
          <span className="rk-week-n num">{day.date}</span>
          <span className="sr-only">{day.mark}</span>
          <span className="rk-week-rule" aria-hidden />
        </li>
      ))}
    </ol>
  );
}
