// SPEC §7 (2026-09-20, #908, issue 930) — the parts a day draws, shared by
// the week's cells (`WeekGrid`) and the phone list (`DayList`): the page a
// stage filter leaves, the two words an empty day says, the day's one
// number (`day-number.ts` decides which), the New or Update chip and the
// lines under a day.
//
// The clamped title carries `rk-cal-label` and the two-word reason
// `rk-cal-empty` — the truncations this screen declared to the layout sweep
// in #354.
"use client";

import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { horizonShortFor, shortCauseFor } from "./card-lines";
import type { DayNumber } from "./day-number";
import type { StageFilter } from "./stages";
import type { DayCell, PageOnDay } from "./month";

/**
 * The page a card draws under the stage filter that is on.
 *
 * REQ-043 c3: with a stage selected, a date holding no page of it draws its
 * date and nothing else — never the date's empty-day reason, because "no
 * page of this stage here" and "nothing was worth publishing here" are
 * different statements.
 */
export function pageShownBy(cell: DayCell, filter: StageFilter): PageOnDay | null {
  if (cell.page === null) return null;
  return filter === "all" || cell.page.stage === filter ? cell.page : null;
}

/** The two words a card draws under the filter that is on, or `null`. Both
 *  are withheld while a stage narrows the grid, for `pageShownBy`'s
 *  reason. */
export function cardLineFor(cell: DayCell, filter: StageFilter): string | null {
  if (filter !== "all" || cell.page !== null) return null;
  return shortCauseFor(cell) ?? horizonShortFor(cell);
}

/**
 * The one number, as the card writes it. `null` where there is none — the
 * card then draws nothing at all in that corner rather than a dash, which
 * would read as a measurement of nothing.
 *
 * **It never clamps.** `docs/DESIGN.md`: "a number is never clamped, so the
 * box changes instead" — and the layout sweep says the same thing
 * mechanically, failing a truncated *value* whether or not its class is
 * allow-listed. The box here cannot change, because it is one of seven
 * equal columns, so the number has to fit instead: the owner's rule for
 * this card is that a five-digit demand fits an 88px column, which is what
 * the compact notation (`12.4k/mo`) and the 11px mono face are for. A
 * number that did not fit would be reported as a containment offender,
 * which is the right way for this to fail.
 */
export function CardNumber(p: { value: DayNumber }): React.JSX.Element | null {
  const value = p.value;
  if (value.kind === "none") return null;
  return (
    <span
      // `ml-auto` here and not on a wrapper around it: a flex item that
      // only holds this one is a second box to contain it in, and it is
      // the box that came up short at 88px.
      // `/4` is the line box, and it is the point: the head row is a fixed
      // 16px so that a card with a number and a card without are the same
      // shape, and an arbitrary `text-[11px]` sets the size alone and
      // inherits the body's 1.55 leading — a 17px line box inside a 16px
      // row, which is a containment offender in the vertical.
      className="num ml-auto shrink-0 whitespace-nowrap text-[11px]/4 opacity-70"
      data-testid="card-number"
      data-number-kind={value.kind}
    >
      {value.text}
      {value.kind === "position" && value.change !== null && value.change !== 0 ? (
        // A search position is better the smaller it is, so a rise in the
        // results is a fall in the number. The arrow states the direction
        // the founder reads and the figure is its size, never a signed
        // integer they have to interpret.
        <span data-testid="card-change">
          {value.change > 0 ? " ▲" : " ▼"}
          {Math.abs(value.change)}
        </span>
      ) : null}
    </span>
  );
}

const CELL = "cell";
const LIST = "list";

/** What a page is, as the board's chip: New, or Update. */
export function KindChip(p: { update: boolean }): React.JSX.Element {
  return (
    <span className="badge badge-sm badge-soft badge-primary shrink-0 font-semibold" data-testid="day-kind">
      {copy(p.update ? "calendar.card.update" : "calendar.chip.new")}
    </span>
  );
}

/** The lines a day adds under its page or in its place: why the week holds
 *  the page, when today's page goes live, or what a stopped or skipped day
 *  means. `goesLive` is absent while the address does not work, so no time
 *  is promised. */
export function DayLines(p: {
  cell: DayCell;
  page: PageOnDay | null;
  goesLive: string | null;
  /** The week's first skipped day says what a skip is; the others do not repeat it. */
  firstSkip: boolean;
  /** A stage filter is on, so an empty day says nothing. */
  filtered: boolean;
  /** The phone list spells its test hooks `list-*`, the week `cell-*`. */
  phone: boolean;
}): React.JSX.Element | null {
  const { cell, page } = p;
  const prefix = p.phone ? LIST : CELL;
  if (page !== null) {
    const today = cell.today && p.goesLive !== null && (page.stage === "your_review" || page.stage === "scheduled");
    return (
      <>
        {page.whyLine === null ? null : (
          <span className="flex min-w-0 flex-col" data-testid={`${prefix}-why`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{copy("calendar.week.why")}</span>
            <span className="min-w-0 text-xs wrap-anywhere" data-testid={`${prefix}-why-line`}>
              {page.whyLine}
            </span>
          </span>
        )}
        {today ? (
          <span className="min-w-0 text-xs font-semibold" data-testid={`${prefix}-goes-live`}>
            {copy("calendar.week.today", { time: p.goesLive! })}
          </span>
        ) : null}
      </>
    );
  }
  if (p.filtered) return null;
  const line = cell.empty?.cause === "page_cannot_go_live" ? "calendar.day.stopped.line" : p.firstSkip ? "calendar.day.skipped.line" : null;
  return line === null ? null : (
    <span className="min-w-0 text-xs wrap-anywhere text-base-content/70" data-testid={`${prefix}-state-line`}>
      {copy(line)}
    </span>
  );
}
