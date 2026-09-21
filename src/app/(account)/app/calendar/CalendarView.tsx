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
//   ?day=2026-10-04  the open day, at every width. Client-only: the model
//                    for the whole month is already here, so opening a day
//                    asks the server for nothing.
//   ?day=none        the panel, closed, at every width.
//   (absent)         **open on today from `md` up, closed below it.**
//
// **REQ-043 c7 is now read as "from `md` up"** (owner, PR #961,
// 2026-09-21). "There is no month in which nothing is selected" is how
// this screen has always opened, and on a desktop it still does: the panel
// stands beside the month and opening on today costs the founder nothing.
// Below `md` the panel is a sheet over the month, so the same default
// meant a customer who tapped Plan landed on a sheet covering their plan.
// So an absent `?day` opens on today from `md` up and is closed below it;
// today is still marked in the list, and a tap opens the sheet. An
// **explicit** `?day` — a date or `none` — is obeyed at every width, so a
// linked day is a linked day on a phone too.
//
// One DOM, and the difference is one utility: the implicitly-open panel
// carries `max-md:hidden`. Each shape of the month is handed the selection
// that is true at the widths it is visible at — the grid the full one
// (`hidden md:block`, where implicit means open), the list the explicit one
// only (`md:hidden`, where implicit means closed) — so neither ever marks a
// day as open while the panel beside it is not.
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
  // Nullable rather than defaulted, because **which day** and **who chose
  // it** are two facts and the second decides the phone. `null` is an
  // absent parameter; anything else is the founder's own.
  const [day, setDay] = useQueryState("day", parseAsString);

  const implicit = day === null;
  const selected: DayKey | null = day === DAY_CLOSED ? null : (day ?? openOn(p.model));
  const cell = selected === null ? undefined : cellFor(p.model, selected);

  /** Opening a day and closing the panel are the same write with two
   *  values, so there is one place the address changes. Both write the
   *  address, so both are explicit and are obeyed at every width. */
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
              // The list is drawn below `md`, where an implicitly open day
              // is a closed panel — so it marks none.
              selected={implicit ? null : selected}
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
            // Nobody chose this day, so below `md` — where the panel is a
            // sheet over the month — it is not open.
            hiddenOnPhone={implicit}
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
