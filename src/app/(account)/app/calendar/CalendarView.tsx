// SPEC §7 — the calendar's two interactions: which stage is showing, and
// which day the panel is on.
//
// Both are view state and neither is a read, which is why they live in one
// client component over a model the server already assembled. The month
// itself is *not* state here: it is in the address (`?month=`), so a month
// the customer switched to survives a reload and can be linked to.
//
// "Today" is the **site-local** day, resolved in `assembleMonth` from the
// customer's own zone, never from the browser's. A month that does not
// contain today opens on its first date instead; there is no month in which
// nothing is selected.
//
// The month is a CSS grid (DESIGN rule 2: a grid that is not a series is CSS
// grid): two columns on a phone, Monday–Sunday from `md`, each day a bordered
// button. The day panel is a daisyUI card beside it from `xl`, sticky there,
// and in flow below it under that — never a drawer.
"use client";

import type React from "react";
import { useState } from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { StageFilter } from "./StageFilter";
import { DayPanelView } from "./DayPanelView";
import {
  EMPTY_COPY_KEY,
  HELD_BY_SETTING_COPY_KEY,
  isLawCause,
  stopForEmptyDay,
  type OneLineCause,
} from "./empty";
import type { CopyKey } from "@/lib/presentation/copy";
import { CHANGE_COPY_KEY } from "./change-line";
import { stoppedWorkStatement, type WorkStop } from "@/lib/presentation/stopped";
import { formatDate } from "../_shell/format";
import { dayNumber, weekdayLabels } from "./dates";
import {
  STAGE_FILTER_COPY_KEY,
  STAGE_TONE,
  TONE_BADGE,
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

/** The one line a cell states for its cause. The two law causes render
 *  through `stoppedWorkStatement`, which is REQ-092's one home (ADR-011);
 *  the five the calendar owns render from its own keys. */
export function emptyLineFor(
  empty: NonNullable<DayCell["empty"]>,
  day: string,
  stopped: WorkStop | null,
  timeZone: string,
  /** Which of the two forms the caller is rendering — the cell's first
   *  line, or the panel's whole account (#209). The grid's is the default
   *  because the grid is the smaller box; a caller that wants the account
   *  asks for it. */
  keys: Record<OneLineCause, CopyKey> = EMPTY_COPY_KEY,
): string | null {
  // REQ-043 c4: the setting that holds pages, each with its own line (#754).
  if (empty.cause === "customer_change_holds_pages") {
    return writtenLine(HELD_BY_SETTING_COPY_KEY[empty.setting]);
  }
  // REQ-071 c11's two slots. Both values are the engine's — the held answer
  // named through its own registry key, and the resumption date formatted
  // in the site's zone (issue #204).
  if (empty.cause === "change_holds_generation") {
    // Issue 866: a category is measured again at once, so its held day names
    // the measurement it waits on and no date. The domain keeps REQ-071
    // c11's dated line — that change does land at the weekly pass.
    if (empty.because === "category") {
      return writtenLine("calendar.empty.change-holds-pages.category");
    }
    return writtenLine(keys[empty.cause], {
      change: copy(CHANGE_COPY_KEY[empty.because]),
      date: formatDate(empty.resumesOn, timeZone),
    });
  }
  const cause = empty.cause;
  if (!isLawCause(cause)) return writtenLine(keys[cause]);
  const stop = stopForEmptyDay({ cause, stop: stopped, since: dayMarker(day) });
  return stoppedWorkStatement(stop, { formatDate: (on) => formatDate(on, timeZone) }).line;
}

/** A `DayKey` as the instant that calendar day is marked by. UTC midnight,
 *  the same convention `_overview/week.ts` states for a day marker: the day
 *  was already resolved in the site's zone, and resolving it again would
 *  shift it back across midnight. Never rendered. */
function dayMarker(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * One date of the month.
 *
 * **What narrowing does.** With `all` selected every date gives its account:
 * a page where there is one, the date's one written line where there is not.
 * With a stage selected a date that holds no page of it renders its date and
 * nothing else — never an empty-date line, because "no page of this stage
 * here" and "nothing was worth publishing here" are different statements.
 *
 * A law-caused empty day states its first line here and the rest of its
 * account in the day panel (issue #113).
 */
function DayButton(p: {
  cell: DayCell;
  filter: StageFilterId;
  selected: boolean;
  stopped: WorkStop | null;
  timeZone: string;
  onSelect: (day: string) => void;
}): React.JSX.Element {
  const { cell } = p;
  if (!cell.inMonth) {
    // Holds a column position in the first or last week; gone where there
    // are no columns to hold.
    return <div className="hidden md:block" aria-hidden="true" data-testid="calendar-placeholder" />;
  }
  const page = cell.page !== null && (p.filter === "all" || cell.page.stage === p.filter) ? cell.page : null;
  // Issue 857: the one quiet marker at the horizon, where the plan stops.
  const marker = cell.horizonMarker ? writtenLine("calendar.horizon.marker") : null;
  const emptyLine =
    p.filter === "all" && cell.page === null && cell.empty !== null && cell.statesLine
      ? emptyLineFor(cell.empty, cell.day, p.stopped, p.timeZone)
      : null;

  return (
    <button
      type="button"
      className={[
        "rounded-box border flex min-h-24 min-w-0 flex-col gap-2 p-2 text-left transition-colors hover:border-primary",
        p.selected
          ? "border-primary bg-primary/10"
          : cell.page === null
            ? "border-base-300 bg-base-200"
            : "border-base-300 bg-base-100",
        cell.today ? "ring-2 ring-primary ring-offset-1 ring-offset-base-100" : "",
      ].join(" ")}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
      data-empty={cell.page === null ? "" : undefined}
      aria-current={p.selected ? "date" : undefined}
      title={page?.title ?? emptyLine ?? marker ?? undefined}
      onClick={() => p.onSelect(cell.day)}
    >
      <span className="flex min-w-0 flex-wrap items-center justify-between gap-1">
        <span className="num text-sm font-semibold" data-testid="cell-date">
          {dayNumber(cell.day)}
        </span>
        {page === null ? null : (
          <span className={`badge badge-sm ${TONE_BADGE[STAGE_TONE[page.stage]]}`}>
            {copy(STAGE_FILTER_COPY_KEY[page.stage])}
          </span>
        )}
      </span>
      {page !== null ? (
        <span className="line-clamp-3 break-words text-sm" data-testid="cell-label">
          {page.title}
        </span>
      ) : emptyLine !== null ? (
        <span className="line-clamp-3 break-words text-xs opacity-70" data-testid="cell-empty-line">
          {emptyLine}
        </span>
      ) : marker === null ? null : (
        <span className="line-clamp-3 break-words text-xs opacity-50" data-testid="calendar-horizon-marker">
          {marker}
        </span>
      )}
    </button>
  );
}

export function CalendarView(p: { model: MonthModel }): React.JSX.Element {
  const [filter, setFilter] = useState<StageFilterId>("all");
  const [selected, setSelected] = useState<string>(() => openOn(p.model));

  const cell = cellFor(p.model, selected);

  return (
    <>
      <StageFilter counts={p.model.counts} selected={filter} onSelect={setFilter} />
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-2">
          {/* Below `md` the grid is two columns of dates, and a list with no
              week columns has no weekdays to head. */}
          <div className="hidden grid-cols-7 gap-2 md:grid" aria-hidden="true">
            {weekdayLabels().map((weekday) => (
              <span key={weekday} className="text-center text-xs font-semibold uppercase tracking-wide opacity-60">
                {weekday}
              </span>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-7" data-testid="calendar-grid">
            {p.model.cells.map((c) => (
              <DayButton
                key={c.day}
                cell={c}
                filter={filter}
                selected={c.day === selected}
                stopped={p.model.stopped}
                timeZone={p.model.timeZone}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
        {cell === undefined ? null : (
          <DayPanelView
            cell={cell}
            timeZone={p.model.timeZone}
            stopped={p.model.stopped}
            destination={p.model.destination}
          />
        )}
      </div>
    </>
  );
}
