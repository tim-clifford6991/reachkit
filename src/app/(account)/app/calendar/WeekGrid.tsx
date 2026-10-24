// SPEC §7 (E5, 2026-10-19) — Plan from `lg`: the committed week as seven day
// cells, Monday to Sunday in the site's zone. Each cell holds its date, its
// page, its state and, where the page can still be stopped, the stop control
// as a ghost warning button (E7). Below `lg` the same cells are `DayList`.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, CircleStop, type LucideIcon } from "lucide-react";
import { PageSketch } from "@/ui/PageSketch";
import { copy } from "@/lib/presentation/copy";
import { say } from "../../../_toast/say";
import { actionsFor, type DayCommand, type DestinationStanding } from "./actions";
import { ANSWER_COPY_KEY, ask } from "./DayPanelView";
import { CardNumber, DayLines, KindChip, cardLineFor, pageShownBy } from "./DayCard";
import { cardLabel, shortCauseFor } from "./card-lines";
import { dayNumberOf } from "./day-number";
import { dayNumber, weekdayShort, type DayKey } from "./dates";
import { WEEK_GRID } from "./frame";
import { dayStateOf, type DayCell } from "./month";
import { DAY_STATE_COPY_KEY, DAY_STATE_TONE, TONE_BADGE, type DayState, type StageFilter } from "./stages";

/** The icon a state badge opens with, only where board Plan draws one. */
const DAY_STATE_ICON: Readonly<Partial<Record<DayState, LucideIcon>>> = {
  planned: Calendar,
  stopped: CircleStop,
};

/** A day's state as a badge, or nothing for a day with nothing to say. */
export function DayStateBadge(p: { cell: DayCell; filter: StageFilter }): React.JSX.Element | null {
  // A stage filter narrows to pages; a hidden page states no state either.
  if (p.cell.page !== null && pageShownBy(p.cell, p.filter) === null) return null;
  if (p.cell.page === null && p.filter !== "all") return null;
  const state = dayStateOf(p.cell);
  if (state === null) return null;
  const tone = DAY_STATE_TONE[state];
  const Icon = DAY_STATE_ICON[state];
  return (
    <span
      className={`badge badge-sm shrink-0 gap-1 whitespace-nowrap font-semibold ${tone === "neutral" ? "badge-ghost" : `badge-soft ${TONE_BADGE[tone]}`}`}
      data-testid="day-state"
      data-state={state}
    >
      {Icon === undefined ? null : <Icon aria-hidden className="size-3" />}
      {copy(DAY_STATE_COPY_KEY[state])}
    </span>
  );
}

/** The stop a cell offers: `actionsFor`'s own stop command, so a cell never
 *  offers a stop the day panel would not. */
function stopOf(cell: DayCell, destination: DestinationStanding | null): { command: DayCommand; draftId: string } | null {
  const found = actionsFor(cell, destination).find(
    (action) => action.kind === "command" && (action.command === "veto" || action.command === "skip")
  );
  return found?.kind === "command" ? { command: found.command, draftId: found.draftId } : null;
}

function WeekCell(p: {
  cell: DayCell;
  filter: StageFilter;
  selected: boolean;
  destination: DestinationStanding | null;
  goesLive: string | null;
  firstSkip: boolean;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  const { cell } = p;
  const page = pageShownBy(cell, p.filter);
  const line = cardLineFor(cell, p.filter);
  const stop = page === null ? null : stopOf(cell, p.destination);
  const [busy, startTransition] = useTransition();
  const [stopped, setStopped] = useState(false);

  function press(asked: { command: DayCommand; draftId: string }): void {
    startTransition(async () => {
      const outcome = await ask(asked.command, asked.draftId);
      // The re-read the write asks for redraws the cell as stopped.
      setStopped(outcome.ok);
      say(copy(outcome.ok ? ANSWER_COPY_KEY[asked.command] : "calendar.answer.refused"), outcome.ok ? "ok" : "bad");
    });
  }

  return (
    <li
      className={[
        "card card-border min-w-0 bg-base-100",
        dayStateOf(cell) === "skipped" ? "border-dashed" : "",
        p.selected ? "ring-2 ring-inset ring-primary" : cell.today ? "border-primary" : "",
      ].join(" ")}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
      data-empty={page === null ? "" : undefined}
    >
      <div className="card-body min-w-0 gap-2 p-2">
        <button
          type="button"
          className="flex min-w-0 flex-col gap-1 text-left"
          aria-current={p.selected ? "date" : undefined}
          aria-label={cardLabel({ cell, page, line })}
          title={page?.title ?? line ?? undefined}
          onClick={() => p.onSelect(cell.day)}
        >
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            <span className="num shrink-0 text-xs font-semibold" data-testid="cell-date">
              {weekdayShort(cell.day)} {dayNumber(cell.day)}
            </span>
            <CardNumber value={dayNumberOf(page)} />
          </span>
          {page === null ? null : <PageSketch primary={cell.today} />}
          {page === null ? (
            line === null ? null : (
              <span
                className="rk-cal-empty line-clamp-2 min-w-0 text-xs wrap-anywhere opacity-70"
                data-testid={shortCauseFor(cell) !== null ? "cell-empty-line" : "calendar-horizon-marker"}
              >
                {line}
              </span>
            )
          ) : (
            <>
              <KindChip update={page.update} />
              <span className="rk-cal-label line-clamp-3 min-w-0 text-sm font-semibold leading-tight wrap-anywhere" data-testid="cell-label">
                {page.title}
              </span>
            </>
          )}
          <DayLines cell={cell} page={page} goesLive={p.goesLive} firstSkip={p.firstSkip} filtered={p.filter !== "all"} phone={false} />
        </button>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1">
          <DayStateBadge cell={cell} filter={p.filter} />
          {stop === null || stopped ? null : (
            <Link href={`/app/draft/${stop.draftId}`} prefetch={true} className="btn btn-xs btn-ghost" data-testid="cell-edit">
              {copy("how.week.edit")}
            </Link>
          )}
          {stop === null || stopped ? null : (
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-warning"
              data-testid="cell-stop"
              disabled={busy}
              onClick={() => press(stop)}
            >
              {copy("calendar.week.stop")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function WeekGrid(p: {
  cells: readonly DayCell[];
  filter: StageFilter;
  selected: DayKey | null;
  destination: DestinationStanding | null;
  goesLive: string | null;
  firstSkip: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  return (
    <ol className={WEEK_GRID} data-testid="calendar-week">
      {p.cells.map((cell) => (
        <WeekCell
          key={cell.day}
          cell={cell}
          filter={p.filter}
          selected={cell.day === p.selected}
          destination={p.destination}
          goesLive={p.goesLive}
          firstSkip={cell.day === p.firstSkip}
          onSelect={p.onSelect}
        />
      ))}
    </ol>
  );
}
