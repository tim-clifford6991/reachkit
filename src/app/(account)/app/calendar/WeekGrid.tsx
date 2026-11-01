// SPEC §7 (E5, 2026-10-19) — Plan's committed week, Monday to Sunday in the
// site's zone, as one row per day at every width (board Plan): the date, the
// page with its one quiet line of why, then its status, and where the page
// can still be stopped, Edit and Stop (E7).
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { say } from "../../../_toast/say";
import { actionsFor, type DayCommand, type DestinationStanding } from "./actions";
import { ANSWER_COPY_KEY, ask } from "./DayPanelView";
import { DayStateBadge, KindChip, cardLineFor, pageShownBy } from "./DayCard";
import { cardLabel, shortCauseFor } from "./card-lines";
import { dayNumber, weekdayShort, type DayKey } from "./dates";
import { DAY_OPEN, DAY_ROW, DAY_STATUS, REGION, WEEK_LIST } from "./frame";
import { dayStateOf, type DayCell } from "./month";
import type { StageFilter } from "./stages";

/** The stop a row offers: `actionsFor`'s own stop command, so a row never
 *  offers a stop the day panel would not. */
function stopOf(cell: DayCell, destination: DestinationStanding | null): { command: DayCommand; draftId: string } | null {
  const found = actionsFor(cell, destination).find(
    (action) => action.kind === "command" && (action.command === "veto" || action.command === "skip")
  );
  return found?.kind === "command" ? { command: found.command, draftId: found.draftId } : null;
}

/** What a day with no page says in its place: a stopped day, else the week's first skip. */
function stateLineOf(cell: DayCell, firstSkip: boolean): "calendar.day.stopped.line" | "calendar.day.skipped.line" | null {
  if (cell.empty?.cause === "page_cannot_go_live") return "calendar.day.stopped.line";
  return firstSkip ? "calendar.day.skipped.line" : null;
}

function DayRow(p: {
  cell: DayCell;
  filter: StageFilter;
  /** The panel is on this day: chosen in the address, or implicit (today, open from `lg` only). */
  selected: "chosen" | "implicit" | null;
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
  const today = page !== null && cell.today && p.goesLive !== null && (page.stage === "your_review" || page.stage === "scheduled");
  const stateLine = page === null && p.filter === "all" ? stateLineOf(cell, p.firstSkip) : null;

  function press(asked: { command: DayCommand; draftId: string }): void {
    startTransition(async () => {
      const outcome = await ask(asked.command, asked.draftId);
      // The re-read the write asks for redraws the row as stopped.
      setStopped(outcome.ok);
      say(copy(outcome.ok ? ANSWER_COPY_KEY[asked.command] : "calendar.answer.refused"), outcome.ok ? "ok" : "bad");
    });
  }

  return (
    <li
      className={[
        DAY_ROW,
        dayStateOf(cell) === "skipped" ? "border-dashed" : "",
        cell.today ? "border-primary bg-primary/5" : "",
        p.selected === "chosen" ? "ring-2 ring-inset ring-primary" : p.selected === "implicit" ? "lg:ring-2 lg:ring-inset lg:ring-primary" : "",
      ].join(" ")}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
      data-empty={page === null ? "" : undefined}
    >
      <button
        type="button"
        className={DAY_OPEN}
        aria-current={p.selected === null ? undefined : "date"}
        aria-label={cardLabel({ cell, page, line })}
        onClick={() => p.onSelect(cell.day)}
      >
        <span className="num pt-0.5 text-xs font-semibold whitespace-nowrap" data-testid="cell-date">
          {weekdayShort(cell.day)} {dayNumber(cell.day)}
        </span>
        <span className="flex min-w-0 flex-col items-start gap-1.5">
          {page === null ? (
            line === null ? null : (
              <span
                className="min-w-0 text-sm wrap-anywhere text-base-content/70"
                data-testid={shortCauseFor(cell) !== null ? "cell-empty-line" : "calendar-horizon-marker"}
              >
                {line}
              </span>
            )
          ) : (
            <>
              <KindChip update={page.update} />
              <span className="min-w-0 text-sm font-semibold leading-snug wrap-anywhere" data-testid="cell-label">
                {page.title}
              </span>
              {page.whyLine === null ? null : (
                <span className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid="cell-why">
                  <span className="eyebrow me-1.5">{copy("calendar.week.why")}</span>
                  <span data-testid="cell-why-line">{page.whyLine}</span>
                </span>
              )}
            </>
          )}
          {stateLine === null ? null : (
            <span className="min-w-0 text-sm wrap-anywhere text-base-content/70" data-testid="cell-state-line">
              {copy(stateLine)}
            </span>
          )}
        </span>
      </button>
      <div className={DAY_STATUS}>
        {today ? (
          <span className="text-sm font-semibold" data-testid="cell-goes-live">
            {copy("calendar.week.today", { time: p.goesLive! })}
          </span>
        ) : (
          <DayStateBadge cell={cell} filter={p.filter} />
        )}
        {stop === null || stopped ? null : (
          <span className="flex gap-1">
            <Link href={`/app/draft/${stop.draftId}`} prefetch={true} className="btn btn-ghost min-h-11 px-2" data-testid="cell-edit">
              {copy("how.week.edit")}
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-warning min-h-11 px-2"
              data-testid="cell-stop"
              disabled={busy}
              onClick={() => press(stop)}
            >
              {copy("calendar.week.stop")}
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

export function WeekGrid(p: {
  cells: readonly DayCell[];
  filter: StageFilter;
  selected: DayKey | null;
  /** Nobody chose the open day, so below `lg`, where the panel is a sheet, it is not open. */
  implicit?: boolean;
  destination: DestinationStanding | null;
  goesLive: string | null;
  firstSkip: DayKey | null;
  onSelect: (day: DayKey) => void;
}): React.JSX.Element {
  return (
    <ol className={WEEK_LIST} data-testid="calendar-week" data-frame={REGION.week}>
      {p.cells.map((cell) => (
        <DayRow
          key={cell.day}
          cell={cell}
          filter={p.filter}
          selected={cell.day !== p.selected ? null : p.implicit === true ? "implicit" : "chosen"}
          destination={p.destination}
          goesLive={p.goesLive}
          firstSkip={cell.day === p.firstSkip}
          onSelect={p.onSelect}
        />
      ))}
    </ol>
  );
}
