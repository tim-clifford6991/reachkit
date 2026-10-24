// SPEC §7 (E5, 2026-10-19) — Plan from `lg`: the committed week as seven day
// cells, Monday to Sunday in the site's zone. Each cell holds its date, its
// page, its state and, where the page can still be stopped, the stop control
// as a ghost warning button (E7). Below `lg` the same cells are `DayList`.
"use client";

import type React from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { copy } from "@/lib/presentation/copy";
import { say } from "../../../_toast/say";
import { actionsFor, type DayCommand, type DestinationStanding } from "./actions";
import { ANSWER_COPY_KEY, ask } from "./DayPanelView";
import { DayCardView, DayStateBadge, cardLineFor, pageShownBy } from "./DayCard";
import { cardLabel } from "./card-lines";
import type { DayKey } from "./dates";
import { WEEK_GRID } from "./frame";
import type { DayCell } from "./month";
import type { StageFilter } from "./stages";

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
    <DayCardView
      cell={cell}
      page={page}
      line={line}
      goesLive={p.goesLive}
      firstSkip={p.firstSkip}
      filtered={p.filter !== "all"}
      selected={p.selected}
      open={(day) => (
        <button
          type="button"
          className="flex min-w-0 flex-col gap-1 text-left"
          aria-current={p.selected ? "date" : undefined}
          aria-label={cardLabel({ cell, page, line })}
          title={page?.title ?? line ?? undefined}
          onClick={() => p.onSelect(cell.day)}
        >
          {day}
        </button>
      )}
      controls={
        <>
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
        </>
      }
    />
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
