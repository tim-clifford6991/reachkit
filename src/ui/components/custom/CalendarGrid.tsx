// src/ui/components/custom/CalendarGrid.tsx — BUILD §2.2, §4.6
//
// One of the five surfaces §2.2 allows custom CSS for: "Custom CSS is
// allowed only for: **the calendar grid**, the day panel, the AI
// dot-matrix, chart SVGs, and the sidebar — nothing else." It lives under
// `components/custom/` rather than beside the fifteen daisyUI primitives so
// the registry's own closure test — "the barrel exports exactly the fifteen
// BP-018 names" — keeps meaning what it says.
//
// `components.md`'s registered contract, which this file implements:
//
//   "One entry per date: `date`, `stage`, `tone`, **`label` required** — a
//    day can never render as a coloured cell alone. Columns `--grid-week`; a
//    cell is never narrower than `--w-cell-min` … Knows nothing of what a
//    stage means and **performs no padding**: an empty day is an absent
//    entry the caller decides about."
//
// Two rules that shape the props below:
//
//  1. **It performs no padding.** There is no code path here that invents a
//     cell, and `entry: null` is the caller's decision rendered, never this
//     component's fallback (§4.6: "the calendar is never padded").
//  2. **It knows nothing of what a stage means.** `stage` arrives as a word
//     and `tone` as a `Tone`; this file maps neither and reads neither. A
//     `Badge` carries the word, because §2.5's words-not-colour rule holds
//     whatever the tone is.
import type React from "react";
import { Badge } from "../Badge";
import "./calendar-grid.css";
import type { Tone } from "../../types";

export interface CalendarGridCell {
  /** The caller's identity for this cell. Passed back to `onSelect`;
   *  never rendered. */
  id: string;
  /** The date numeral, already formatted by the caller. Rendered mono
   *  (§2.3: "Every numeral, date … is JetBrains Mono"). */
  date: string;
  /** The one entry on this date, or `null`. Both `label` and `stage` are
   *  required on the entry: a cell can never be a colour alone. */
  entry: { label: string; stage: string; tone: Tone } | null;
  /** The caller's one written line for a date with no entry, or `null`
   *  where the owner has not written it yet. Never composed here. */
  emptyLine: string | null;
  today: boolean;
  selected: boolean;
  /** A cell that exists only to hold a column position in the first or
   *  last week. It renders no content at all, and it disappears entirely
   *  where there are no columns to hold. */
  placeholder: boolean;
}

/** Today is a ring, and the selection is a ground — both are classes on the
 *  one cell element, so neither can be expressed as a second markup path.
 *  §4.6: "Today ringed accent." */
function cellClass(cell: CalendarGridCell): string {
  return [
    "rk-cal-cell",
    cell.today ? "rk-cal-today" : "",
    cell.selected ? "rk-cal-selected" : "",
  ]
    .filter((c) => c !== "")
    .join(" ");
}

export function CalendarGrid(p: {
  /** The seven column heads, Monday first. Values, supplied by the caller. */
  weekdays: readonly string[];
  cells: readonly CalendarGridCell[];
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="rk-cal">
      {/* Below --breakpoint-md the grid is seven rows, and a one-column
          list has no columns to head — the head is hidden there, in CSS,
          rather than by a second markup path. */}
      <div className="rk-cal-head" aria-hidden="true">
        {p.weekdays.map((weekday) => (
          <span key={weekday} className="rk-cal-weekday">
            {weekday}
          </span>
        ))}
      </div>
      <div className="rk-cal-grid" data-testid="calendar-grid">
        {p.cells.map((cell) =>
          cell.placeholder ? (
            <div key={cell.id} className="rk-cal-cell rk-cal-out" aria-hidden="true" />
          ) : (
            <button
              key={cell.id}
              type="button"
              className={cellClass(cell)}
              data-testid={`calendar-cell-${cell.id}`}
              aria-pressed={cell.selected}
              onClick={() => p.onSelect(cell.id)}
            >
              <span className="num rk-cal-date">{cell.date}</span>
              {cell.entry === null ? (
                cell.emptyLine === null ? null : (
                  <span className="rk-cal-empty">{cell.emptyLine}</span>
                )
              ) : (
                <>
                  <Badge tone={cell.entry.tone}>{cell.entry.stage}</Badge>
                  <span className="rk-cal-label">{cell.entry.label}</span>
                </>
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
