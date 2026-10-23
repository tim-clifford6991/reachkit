// SPEC §7 (E5, 2026-10-19) — the Plan screen's own state: which stage the
// filter shows and which day the panel is open on.
//
// **The open day lives in the address** (`nuqs`, `docs/DESIGN.md`'s library
// list), so a day opened is linkable and survives a reload:
//
//   ?day=2026-10-04  the open day, at every width.
//   ?day=none        the panel, closed, at every width.
//   (absent)         **open on today from `lg` up, closed below it** (owner,
//                    PR #961): below `lg` the panel is a sheet over the
//                    list, and a phone must land on its plan, not a sheet.
//
// One DOM, two shapes of the same seven days: the cells from `lg`
// (`WeekGrid`), a list below it (`DayList`). The choice is a media query,
// so it is right before any script runs.
"use client";

import type React from "react";
import { useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { copy } from "@/lib/presentation/copy";
import { StageFilter } from "./StageFilter";
import { DayPanelView } from "./DayPanelView";
import { WeekGrid } from "./WeekGrid";
import { DayList } from "./DayList";
import { BODY, FILTERS, REGION, WEEK_CARD, WEEK_CARD_BODY, WEEK_HEADING_ID, WEEK_SHOWN } from "./frame";
import type { DayKey } from "./dates";
import { dayStateOf } from "./month";
import type { StageFilter as StageFilterId } from "./stages";
import type { WeekModel } from "./month";

/** The `?day=` value that means "the founder closed the panel". A stated
 *  value, not an absent parameter: see the header. */
export const DAY_CLOSED = "none";

/** The day the panel opens on when the address says nothing: today. */
export function openOn(week: WeekModel): DayKey {
  return week.today;
}

export function CalendarView(p: {
  week: WeekModel;
  /** Today's go-live clock time; `null` while no time can be promised. */
  goesLive?: string | null;
  /** The week card's head and foot, written on the server. */
  head?: React.ReactNode;
  foot?: React.ReactNode;
}): React.JSX.Element {
  const [filter, setFilter] = useState<StageFilterId>("all");
  // Nullable rather than defaulted, because **which day** and **who chose
  // it** are two facts and the second decides the phone. `null` is an
  // absent parameter; anything else is the founder's own.
  const [day, setDay] = useQueryState("day", parseAsString);

  const implicit = day === null;
  const selected: DayKey | null = day === DAY_CLOSED ? null : (day ?? openOn(p.week));
  const cell = selected === null ? undefined : p.week.cells.find((found) => found.day === selected);
  const firstSkip = p.week.cells.find((found) => dayStateOf(found) === "skipped")?.day ?? null;
  const goesLive = p.goesLive ?? null;

  /** Opening a day and closing the panel are the same write with two
   *  values, so there is one place the address changes. Both write the
   *  address, so both are explicit and are obeyed at every width. */
  function openDay(next: DayKey | null): void {
    void setDay(next ?? DAY_CLOSED);
  }

  return (
    <>
      {/* The filters, and the one note about the week: what the number on
          a live card is. §7 (issue 857) states supply once, at the top. */}
      <div className={FILTERS}>
        <StageFilter counts={p.week.counts} selected={filter} onSelect={setFilter} />
        <p className="text-xs opacity-70" data-testid="calendar-live-number-note">
          {copy("calendar.note.live-number")}
        </p>
      </div>

      <div className={BODY} data-frame={REGION.body}>
        <section className={WEEK_CARD} aria-labelledby={p.head === undefined ? undefined : WEEK_HEADING_ID} data-testid="plan-week-card">
          <div className={WEEK_CARD_BODY}>
            {p.head}
            <WeekGrid
              cells={p.week.cells}
              filter={filter}
              selected={selected}
              destination={p.week.destination}
              goesLive={goesLive}
              firstSkip={firstSkip}
              onSelect={(next) => openDay(next)}
            />
            <div className={WEEK_SHOWN}>
              <DayList
                cells={p.week.cells}
                filter={filter}
                // The list is drawn below `lg`, where an implicitly open day
                // is a closed panel — so it marks none.
                selected={implicit ? null : selected}
                goesLive={goesLive}
                firstSkip={firstSkip}
                onSelect={(next) => openDay(next)}
              />
            </div>
            {p.foot}
          </div>
        </section>

        {cell === undefined ? null : (
          <DayPanelView
            cell={cell}
            timeZone={p.week.timeZone}
            stopped={p.week.stopped}
            destination={p.week.destination}
            // Nobody chose this day, so below `lg` — where the panel is a
            // sheet over the list — it is not open.
            hiddenOnPhone={implicit}
            onClose={() => openDay(null)}
          />
        )}
      </div>

      {/* The week's spares, used only where a day's page cannot be
          written (SPEC §7, issue 1559). Absent when there are none. */}
      {p.week.spares.length === 0 ? null : (
        <details className="collapse collapse-arrow card-border bg-base-100" data-testid="calendar-spares">
          <summary className="collapse-title flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold">
              <span className="num">{p.week.spares.length}</span> {copy("calendar.spares.title")}
            </span>
            <span className="text-sm text-base-content/70">{copy("calendar.spares.note")}</span>
          </summary>
          <ul className="collapse-content list min-w-0">
            {p.week.spares.map((search) => (
              <li key={search} className="list-row min-w-0 px-0 wrap-anywhere" data-testid="calendar-spare">
                {search}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
