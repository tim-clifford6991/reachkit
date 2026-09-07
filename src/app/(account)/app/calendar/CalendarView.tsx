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
import {
  CalendarGrid,
  DayPanelLayout,
  type CalendarGridCell,
} from "@/ui/components/custom";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { StageFilter } from "./StageFilter";
import { DayPanelView } from "./DayPanelView";
import { EMPTY_COPY_KEY, isLawCause, stopForEmptyDay } from "./empty";
import { stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { formatDate } from "../_shell/format";
import { dayNumber, weekdayLabels } from "./dates";
import {
  STAGE_FILTER_COPY_KEY,
  STAGE_TONE,
  type StageFilter as StageFilterId,
} from "./stages";
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
function toGridCell(
  cell: DayCell,
  filter: StageFilterId,
  selected: string,
  stopped: WorkStop | null,
  timeZone: string,
): CalendarGridCell {
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
    // One cell, one line. A law-caused empty day states c1's line here and
    // c2's and c4's beside it in the day panel: a month grid cell holds a
    // date and a single sentence, and three sentences in one cell would be
    // a different screen rather than a rendering of the law. The panel is
    // the place on this surface where c2 and c4 are read (issue #113).
    emptyLine:
      filter === "all" && cell.page === null && cell.empty !== null
        ? emptyLineFor(cell.empty.cause, cell.day, stopped, timeZone)
        : null,
    today: cell.today,
    selected: cell.day === selected,
    placeholder: !cell.inMonth,
  };
}

/** The one line a cell states for its cause. The two law causes render
 *  through `stoppedWorkStatement`, which is REQ-092's one home (ADR-011);
 *  the five the calendar owns render from its own keys. */
export function emptyLineFor(
  cause: NonNullable<DayCell["empty"]>["cause"],
  day: string,
  stopped: WorkStop | null,
  timeZone: string,
): string | null {
  if (!isLawCause(cause)) return writtenLine(EMPTY_COPY_KEY[cause]);
  const stop = stopForEmptyDay({ cause, stop: stopped, since: dayMarker(day) });
  return stoppedWorkStatement(stop, { formatDate: (on) => formatDate(on, timeZone) }).line;
}

/** A `DayKey` as the instant that calendar day is marked by. UTC midnight,
 *  the same convention `_overview/week.ts` states for a day marker: the day
 *  was already resolved in the site's zone, and resolving it again would
 *  shift it back across midnight. Never rendered — `WorkStop.since` is read
 *  for which days a stop accounts for and never as a cause. */
function dayMarker(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function CalendarView(p: { model: MonthModel }): React.JSX.Element {
  const [filter, setFilter] = useState<StageFilterId>("all");
  const [selected, setSelected] = useState<string>(() => openOn(p.model));

  const cell = cellFor(p.model, selected);

  return (
    <>
      <StageFilter
        counts={p.model.counts}
        selected={filter}
        onSelect={setFilter}
      />
      <DayPanelLayout
        grid={
          <CalendarGrid
            weekdays={weekdayLabels()}
            cells={p.model.cells.map((c) =>
              toGridCell(c, filter, selected, p.model.stopped, p.model.timeZone)
            )}
            onSelect={setSelected}
          />
        }
        panel={
          cell === undefined ? null : (
            <DayPanelView cell={cell} timeZone={p.model.timeZone} stopped={p.model.stopped} />
          )
        }
      />
    </>
  );
}
