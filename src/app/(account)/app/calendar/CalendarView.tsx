// BUILD §4.6 — the calendar's two interactions: which stage is showing, and
// which day the panel is on.
//
// Both are view state and neither is a read, which is why they live in one
// client component over a model the server already assembled. The month
// itself is *not* state here: it is in the address (`?month=`), so a month
// the customer switched to survives a reload and can be linked to.
//
// REQ-043 criterion 7: "when the day detail first renders, then today is
// the selected day" — and "today" is the **site-local** day, resolved in
// `assembleMonth` from the customer's own zone, never from the browser's.
// A month that does not contain today opens on its first date instead;
// there is no month in which nothing is selected.
"use client";

import type React from "react";
import { useState } from "react";
import { CalendarGrid, DayPanelLayout, type CalendarGridCell } from "@/ui/components/custom";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { StageFilter } from "./StageFilter";
import { DayPanelView } from "./DayPanelView";
import { EMPTY_COPY_KEY } from "./empty";
import { dayNumber, weekdayLabels } from "./dates";
import { STAGE_FILTER_COPY_KEY, STAGE_TONE, type StageFilter as StageFilterId } from "./stages";
import { cellFor, type DayCell, type MonthModel } from "./month";

/** The day the panel opens on: today where this month holds it, and this
 *  month's first date otherwise. Never nothing. */
function openOn(model: MonthModel): string {
  const today = model.cells.find((c) => c.inMonth && c.today);
  const first = model.cells.find((c) => c.inMonth);
  return today?.day ?? first?.day ?? model.today;
}

/**
 * One `DayCell` as the grid's own cell type.
 *
 * **What narrowing does, stated once.** With `all` selected every date
 * gives its account: a page where there is one, the date's one written
 * line where there is not. With a stage selected the view narrows to that
 * stage — a date that holds no page of it renders its date and nothing
 * else. It does **not** render an empty-date line under narrowing, and
 * that is the point: "no page of this stage here" and "nothing was worth
 * publishing here" are different statements, and REQ-043 c3 forbids the
 * second from being said on a date it is not true of.
 */
function toGridCell(cell: DayCell, filter: StageFilterId, selected: string): CalendarGridCell {
  const showing = filter === "all" || cell.page?.stage === filter;
  return {
    id: cell.day,
    date: dayNumber(cell.day),
    entry:
      cell.page === null || !showing
        ? null
        : {
            label: cell.page.title,
            stage: copy(STAGE_FILTER_COPY_KEY[cell.page.stage]),
            tone: STAGE_TONE[cell.page.stage],
          },
    emptyLine:
      filter === "all" && cell.page === null && cell.empty !== null
        ? writtenLine(EMPTY_COPY_KEY[cell.empty.cause])
        : null,
    today: cell.today,
    selected: cell.day === selected,
    placeholder: !cell.inMonth,
  };
}

export function CalendarView(p: { model: MonthModel }): React.JSX.Element {
  const [filter, setFilter] = useState<StageFilterId>("all");
  const [selected, setSelected] = useState<string>(() => openOn(p.model));

  const cell = cellFor(p.model, selected);

  return (
    <>
      <StageFilter counts={p.model.counts} selected={filter} onSelect={setFilter} />
      <DayPanelLayout
        grid={
          <CalendarGrid
            weekdays={weekdayLabels()}
            cells={p.model.cells.map((c) => toGridCell(c, filter, selected))}
            onSelect={setSelected}
          />
        }
        panel={
          cell === undefined ? null : <DayPanelView cell={cell} timeZone={p.model.timeZone} />
        }
      />
    </>
  );
}
