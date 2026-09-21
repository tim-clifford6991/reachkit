// SPEC §7 (2026-09-20, #908, issue 930) — "on a phone the month is a list
// of days and the day opens as a sheet".
//
// **The same three facts, in a shape a phone can read.** A seven-column
// grid at 390px gives each day 47 pixels, which cannot hold a two-line
// title, so below `md` the month is a list: one row per date, the weekday
// and the date on the left, the title and the stage word in the middle, and
// the day's one number on the right. Nothing is dropped and nothing is
// added — it is the card's own parts (`DayCard.tsx`) laid out along a row
// instead of down a card.
//
// **Only the dates this calendar has something to say about.** A leading or
// trailing column position is a fact about a grid, and a list has no
// columns to hold — so out-of-month cells are simply not in the list, which
// is what "it is not padding" means when there is no grid to pad.
//
// **Its own test hooks.** Both shapes are in the document at every width —
// the choice between them is a media query, so it is right before any
// script runs — so the list spells its parts `list-*` where the grid spells
// them `cell-*`. A suite counting one shape then counts one shape.
//
// A daisyUI `list`, in the route (`docs/DESIGN.md` rule 1).
"use client";

import type React from "react";
import { CardNumber, StageMark, cardLineFor, pageShownBy } from "./DayCard";
import { cardLabel, shortCauseFor } from "./card-lines";
import { dayNumberOf } from "./day-number";
import { dayNumber, weekdayShort, type DayKey } from "./dates";
import type { MonthModel } from "./month";
import type { StageFilter } from "./stages";

export function DayList(p: {
  model: MonthModel;
  filter: StageFilter;
  selected: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  const dates = p.model.cells.filter((cell) => cell.inMonth);

  return (
    <ul className="list bg-base-100 rounded-box border border-base-200" data-testid="calendar-list">
      {dates.map((cell) => {
        const page = pageShownBy(cell, p.filter);
        const line = cardLineFor(cell, p.filter);
        const isCause = line !== null && shortCauseFor(cell) !== null;
        const open = cell.day === p.selected;
        return (
          <li key={cell.day} className="list-row min-w-0 p-0">
            <button
              type="button"
              className={`flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                open ? "bg-primary/5" : ""
              }`}
              data-testid={`calendar-day-${cell.day}`}
              data-today={cell.today ? "" : undefined}
              data-empty={page === null ? "" : undefined}
              aria-current={open ? "date" : undefined}
              aria-label={cardLabel({ cell, page, line })}
              onClick={() => p.onSelect(cell.day)}
            >
              <span className="flex w-9 shrink-0 flex-col items-center">
                <span className="text-[11px] font-semibold opacity-60">
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

              <span className="flex min-w-0 grow flex-col gap-1">
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
                  <>
                    <span
                      className="rk-cal-label line-clamp-2 min-w-0 text-sm font-semibold leading-tight"
                      data-testid="list-label"
                    >
                      {page.title}
                    </span>
                    <StageMark page={page} />
                  </>
                )}
              </span>

              <CardNumber value={dayNumberOf(page)} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
