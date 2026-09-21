// SPEC §7 (2026-09-20, #908, issue 930) — the Plan screen's own state, and
// the two shapes a month takes.
//
// **The open day lives in the address** (`nuqs`, `docs/DESIGN.md`'s
// library list — "hand-rolled URL state: month, day, tab, filters, setup
// step"), beside the month, which is a pair of server-rendered links in
// `page.tsx` and always has been (#269, #354 — and `nuqs` replaces
// hand-rolled state, not an `<a href>`). So a day opened is linkable,
// shareable and survives a reload:
//
//   ?day=2026-10-04  the open day. Client-only: the model for the whole
//                    month is already here, so opening a day asks the
//                    server for nothing.
//   ?day=none        the panel, closed. A **stated** closed rather than an
//                    absent parameter, because absent has to mean "open on
//                    today" — REQ-043 c7's "there is no month in which
//                    nothing is selected" is how this screen has always
//                    opened, and §7's new promise is that the founder can
//                    then close it and have that stick.
//
// **Two shapes, one month.** From `md` the month is
// `react-day-picker`'s grid of fixed-height cards (`MonthGrid`); below it
// the same three facts are a list of days (`DayList`), because seven
// columns at 390px give a day 47 pixels and a two-line title does not fit
// in them. Both are rendered and one is shown: the choice is a media query,
// so it is right before any script runs and cannot flash the wrong one.
//
// The day panel is one element in both shapes — a card beside the month
// from `xl`, and the sheet a phone opens from the bottom below that
// (`DayPanelView`'s own note).
"use client";

import type React from "react";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { copy } from "@/lib/presentation/copy";
import { StageFilter } from "./StageFilter";
import { DayPanelView } from "./DayPanelView";
import { MonthGrid } from "./MonthGrid";
import { DayList } from "./DayList";
import type { DayKey } from "./dates";
import type { StageFilter as StageFilterId } from "./stages";
import { cellFor, type MonthModel } from "./month";

/** The `?day=` value that means "the founder closed the panel". A stated
 *  value, not an absent parameter: see the header. */
export const DAY_CLOSED = "none";

/** The day the panel opens on when the address says nothing: today where
 *  this month holds it, and this month's first date otherwise. Never
 *  nothing — closing is what nothing is for. */
export function openOn(model: MonthModel): DayKey {
  const today = model.cells.find((c) => c.inMonth && c.today);
  const first = model.cells.find((c) => c.inMonth);
  return today?.day ?? first?.day ?? model.today;
}

export function CalendarView(p: { model: MonthModel }): React.JSX.Element {
  const [filter, setFilter] = useState<StageFilterId>("all");
  const [day, setDay] = useQueryState("day", parseAsString.withDefault(openOn(p.model)));

  const selected: DayKey | null = day === DAY_CLOSED ? null : day;
  const cell = selected === null ? undefined : cellFor(p.model, selected);

  /** Opening a day and closing the panel are the same write with two
   *  values, so there is one place the address changes. */
  function openDay(next: DayKey | null): void {
    void setDay(next ?? DAY_CLOSED);
  }

  return (
    <>
      <StageFilter counts={p.model.counts} selected={filter} onSelect={setFilter} />

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {/* The month, in the shape the width can read. */}
          <div className="hidden md:block">
            <MonthGrid
              model={p.model}
              filter={filter}
              selected={selected}
              onSelect={(next) => openDay(next)}
            />
          </div>
          <div className="md:hidden">
            <DayList
              model={p.model}
              filter={filter}
              selected={selected}
              onSelect={(next) => openDay(next)}
            />
          </div>
        </div>

        {cell === undefined ? null : (
          <DayPanelView
            cell={cell}
            timeZone={p.model.timeZone}
            stopped={p.model.stopped}
            destination={p.model.destination}
            onClose={() => openDay(null)}
          />
        )}
      </div>

      {/* The one note under the month: what the number on a live card is.
          Not a supply statement and never a second one — §7 (issue 857)
          states supply once, at the top of the screen. */}
      <p className="text-xs opacity-70" data-testid="calendar-live-number-note">
        {copy("calendar.note.live-number")}
      </p>
    </>
  );
}
