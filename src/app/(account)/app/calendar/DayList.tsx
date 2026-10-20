// SPEC §7 (2026-10-08, issue 1340) — "on a phone Plan is the recent days
// and the days ahead", and the day opens as a sheet.
//
// **The same three facts, in a shape a phone can read.** A seven-column
// grid at 390px gives each day 47 pixels, which cannot hold a two-line
// title, so below `lg` Plan is a list: one row per date, the weekday and
// the date on the left, the title and the stage word in the middle, and
// the day's one number on the right. It is the card's own parts
// (`DayCard.tsx`) laid out along a row instead of down a card.
//
// **The same seven days as the cells, in the same order** (E5): Monday to
// Sunday of the site-local week that contains today (`month.ts`'s `weekOf`).
// Which week that is, is decided there and not here: this file draws the
// cells it is handed.
//
// **Its own test hooks.** Both shapes are in the document at every width —
// the choice between them is a media query, so it is right before any
// script runs — so the list spells its parts `list-*` where the grid spells
// them `cell-*`. A suite counting one shape then counts one shape.
//
// **Three columns, and the right-hand one is the row's own** (issue 965):
// the weekday and date, the title and its stage word, and — right-aligned
// at a fixed width — the day's one number with the mark for an update
// under it. Down the list every number ends at the same x, which is the
// whole point of a column.
//
// **`list-row` goes on the row, not on the `<li>`.** daisyUI's `.list-row`
// *is* the grid — `grid-template-columns: minmax(0, auto) 1fr` with
// `grid-auto-flow: column`, and a row's children are its columns. With it
// on the `<li>` and the whole row as that `<li>`'s single child, the row
// landed in the `minmax(0, auto)` track and was sized to its **content**:
// `w-full` on a grid item resolves against an `auto` track, so it measured
// 156px on a short row and 357px on a long one, and the number went
// wherever the title ended. That is #965. The divider is unaffected —
// daisyUI draws it on `.list > :not(:last-child) .list-row`, a descendant
// selector, so a `.list-row` inside the `<li>` still gets one.
//
// A daisyUI `list`, in the route (`docs/DESIGN.md` rule 1).
"use client";

import type React from "react";
import { CardNumber, UpdateMark, cardLineFor, pageShownBy } from "./DayCard";
import { DayStateBadge } from "./WeekGrid";
import { cardLabel, shortCauseFor } from "./card-lines";
import { dayNumberOf } from "./day-number";
import { dayNumber, weekdayShort, type DayKey } from "./dates";
import { DAY_ROW, REGION, WEEK_LIST } from "./frame";
import type { DayCell } from "./month";
import type { StageFilter } from "./stages";

export function DayList(p: {
  cells: readonly DayCell[];
  filter: StageFilter;
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  return (
    <ul className={WEEK_LIST} data-testid="calendar-list" data-frame={REGION.week}>
      {p.cells.map((cell) => {
        const page = pageShownBy(cell, p.filter);
        const line = cardLineFor(cell, p.filter);
        const isCause = line !== null && shortCauseFor(cell) !== null;
        const open = cell.day === p.selected;
        return (
          <li key={cell.day} className="min-w-0">
            <button
              type="button"
              // The three tracks. The last is `minmax(4rem, auto)` and not
              // a fixed `4rem`: 4rem holds every number this screen draws
              // (the widest measured is `12.4k/mo` at 56px), and a number
              // is never clamped — so a longer one widens its own column
              // and takes the room from the title, which clamps, rather
              // than running past the row's edge.
              className={`${DAY_ROW} text-left transition-colors ${
                open ? "bg-primary/5" : ""
              }`}
              data-testid={`calendar-day-${cell.day}`}
              data-today={cell.today ? "" : undefined}
              data-empty={page === null ? "" : undefined}
              aria-current={open ? "date" : undefined}
              aria-label={cardLabel({ cell, page, line })}
              onClick={() => p.onSelect(cell.day)}
            >
              <span className="flex min-w-0 flex-col items-center">
                <span className="text-[11px] font-semibold opacity-70">
                  {weekdayShort(cell.day)}
                </span>
                <span
                  className={[
                    "num text-sm font-semibold",
                    cell.today ? "rounded bg-primary px-1 text-primary-content" : "",
                  ].join(" ")}
                  data-testid="list-date"
                >
                  {dayNumber(cell.day)}
                </span>
              </span>

              <span className="flex min-w-0 flex-col items-start gap-1">
                {page === null ? (
                  line === null ? null : (
                    <span
                      className="rk-cal-empty min-w-0 truncate text-sm opacity-70"
                      data-testid={isCause ? "list-empty-line" : "list-horizon-marker"}
                    >
                      {line}
                    </span>
                  )
                ) : (
                  <span
                    className="rk-cal-label line-clamp-2 min-w-0 text-sm font-semibold leading-tight"
                    data-testid="list-label"
                  >
                    {page.title}
                  </span>
                )}
                <DayStateBadge cell={cell} filter={p.filter} />
              </span>

              {/* The row's own column: the number, right-aligned, and the
                  mark for an update beneath it. It is always drawn, even
                  for a date with neither, so the three tracks are the same
                  three on every row. */}
              <span className="flex min-w-0 flex-col items-end gap-1" data-testid="list-number">
                <CardNumber value={dayNumberOf(page)} />
                {page?.update === true ? <UpdateMark /> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
