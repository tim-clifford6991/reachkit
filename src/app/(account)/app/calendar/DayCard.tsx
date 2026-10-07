// SPEC §7 (2026-09-20, #908, issue 930) — the day card, and the five rules
// it obeys at every width.
//
//   1  Top: the date, and **exactly one** number — searches a month before
//      the page is live, its place and change once it is, the day it is
//      first measured when that has not happened yet. Which one is
//      `day-number.ts`'s decision, not this file's.
//   2  Middle: the page title, cut to two lines. Never a sentence, a reason
//      or a rival's name.
//   3  Bottom: one stage word with its dot, and a mark when the page is an
//      update.
//   4  A date with no page gets at most two words; the day panel carries
//      the whole reason (`card-lines.ts`).
//   5  The card is a **fixed height** at every width. Nothing wraps past it
//      and nothing scrolls inside it.
//
// Rule 5 is the one the markup has to earn, and it is earned by giving
// every part a box it cannot grow out of: a head row of fixed height, a
// title that clamps to two lines, a foot row that truncates, and `min-w-0`
// on every flex child so a long word shrinks its own box instead of
// widening its parent's. The one thing that used to defeat it was a
// daisyUI `badge` (#944); `stages.ts` says why the stage is a dot and a
// word now.
//
// The clamped title carries `rk-cal-label` and the two-word reason
// `rk-cal-empty` — the truncations this screen declared to the layout sweep
// in #354. The whole string stays reachable on the card's own `title`, so a
// cut line is a cut line and never a lost value.
//
// **The `<button>` is `react-day-picker`'s.** The library owns the roving
// focus and the arrow keys across the month, so the card renders inside the
// button the library hands it rather than drawing one of its own; the props
// come in whole and only the label is replaced, because the card states
// more than a date. The phone list, which is not a grid, draws its own row
// from the same parts (`DayList.tsx`).
"use client";

import type React from "react";
import { RefreshCw } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { cardLabel, horizonShortFor, kindWord, shortCauseFor } from "./card-lines";
import { dayNumberOf, type DayNumber } from "./day-number";
import { dayNumber } from "./dates";
import {
  STAGE_BEACON,
  STAGE_FILTER_COPY_KEY,
  STAGE_MARK_AT,
  STAGE_TONE,
  TONE_DOT,
  TONE_INK,
  type StageFilter,
} from "./stages";
import type { DayCell, PageOnDay } from "./month";

/** The card's fixed height. One number, in one place, so no state of the
 *  card can be a different height from another. */
export const CARD_HEIGHT = "h-26";

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

/**
 * Rule 3's foot: one stage word with its dot, and a mark for an update.
 *
 * **The word is never cut** (owner, PR #961). It takes its own width and
 * does not clamp, so `scrollWidth` can never exceed `clientWidth` on it.
 * When the row is tight it is the *mark* that goes — `STAGE_MARK_AT` says
 * at what width each stage's word has room for one beside it, and the
 * panel says "Update" in full whatever the card can fit.
 */
export function StageMark(p: {
  page: PageOnDay;
  /** Whether this row may drop the mark on a narrow card. True on the
   *  month grid, where a card is one of seven equal columns; false in the
   *  phone list, whose row is the width of the screen. */
  narrowable?: boolean;
  /** Whether the mark for an update is drawn **here**. `false` in the
   *  phone list, where it is drawn in the row's own right-hand column
   *  beneath the number rather than wherever the stage word happens to end
   *  (issue 965). */
  mark?: boolean;
}): React.JSX.Element {
  const tone = STAGE_TONE[p.page.stage];
  const word = copy(STAGE_FILTER_COPY_KEY[p.page.stage]);
  return (
    <span className="flex min-w-0 items-center gap-1" data-testid="card-stage">
      <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[tone]} ${STAGE_BEACON[p.page.stage]}`} aria-hidden />
      <span
        className={`shrink-0 whitespace-nowrap text-[11px]/4 font-semibold ${TONE_INK[tone]}`}
        data-testid="card-stage-word"
      >
        {word}
      </span>
      {p.page.update && p.mark !== false ? (
        <RefreshCw
          size={12}
          strokeWidth={1.75}
          className={`ml-auto shrink-0 opacity-70 ${
            p.narrowable === true ? `hidden ${STAGE_MARK_AT[p.page.stage]}` : ""
          }`}
          aria-label={kindWord(true)}
          data-testid="card-update-mark"
        />
      ) : null}
    </span>
  );
}

/** The mark for an update, drawn outside the stage row. The phone list
 *  puts it in the row's right-hand column, under the number (issue 965);
 *  the card draws it inside `StageMark`, where there is no column to put
 *  it in. One glyph and one label, spelled once. */
export function UpdateMark(): React.JSX.Element {
  return (
    <RefreshCw
      size={12}
      strokeWidth={1.75}
      className="shrink-0 opacity-70"
      aria-label={kindWord(true)}
      data-testid="card-update-mark"
    />
  );
}

export function DayCard(p: {
  cell: DayCell;
  filter: StageFilter;
  selected: boolean;
  /** `react-day-picker`'s own button props, kept whole. */
  buttonProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
}): React.JSX.Element {
  const { cell } = p;
  const page = pageShownBy(cell, p.filter);
  const line = cardLineFor(cell, p.filter);
  const isCause = line !== null && shortCauseFor(cell) !== null;

  if (!cell.inMonth) {
    // A column position in the first or last week, and nothing else: not a
    // date this calendar has anything to say about, and emphatically not
    // padding. It keeps the card's height so the row's baseline does not
    // move, and the library has already disabled it, so nothing can be
    // pressed on it. `block`, as a card is a flex box: an inline button
    // sits on a text baseline and made its week 5.6px taller than a week
    // of cards (issue 1320).
    return (
      <button
        {...p.buttonProps}
        className={`rounded-box block w-full ${CARD_HEIGHT}`}
        aria-hidden="true"
        tabIndex={-1}
        aria-label={undefined}
        data-testid="calendar-placeholder"
      />
    );
  }

  return (
    <button
      {...p.buttonProps}
      className={[
        // `@container/day`: the mark for an update is shown or dropped on
        // **this card's** own width, not on the viewport's. The column a
        // card sits in narrows with the side panel, the day panel and the
        // window, and none of those is a media query.
        "@container/day rounded-box flex w-full min-w-0 flex-col gap-1 overflow-hidden p-1 text-left transition-[background-color,box-shadow] duration-150",
        CARD_HEIGHT,
        // The calm layer (issue 1071, board R12-5-Plan): a day with a page
        // is a white card on the card's own ring edge; an empty day is a
        // flat grey cell with no border; today is tinted.
        cell.today
          ? "bg-primary/10"
          : cell.page === null
            ? "bg-base-200"
            : "bg-base-100 shadow-(--shadow-card)",
        // The open day is a 2px accent ring. `ring-inset` draws it inside
        // the border box, so it costs a column that is 88px at its
        // narrowest nothing (UI-SPEC §0 10); hover draws a hairline ring on
        // every other day.
        p.selected ? "ring-2 ring-inset ring-primary" : "hover:ring-1 hover:ring-inset hover:ring-base-content/20",
      ].join(" ")}
      data-testid={`calendar-cell-${cell.day}`}
      data-today={cell.today ? "" : undefined}
      data-empty={page === null ? "" : undefined}
      // The day the panel is open on, for a reader. `react-day-picker`
      // writes `aria-selected` on the grid cell from the same value; this
      // is the date the screen is *showing*, which is what `aria-current`
      // is for, and the two are one fact because both come from `selected`.
      aria-current={p.selected ? "date" : undefined}
      aria-label={cardLabel({ cell, page, line })}
      title={page?.title ?? line ?? undefined}
    >
      {/* Rule 1 — the date and at most one number, on one row of fixed
          height, so a card with a number and one without are the same
          shape. */}
      <span className="flex h-4 min-w-0 items-center gap-1">
        <span className="num shrink-0 text-xs font-semibold" data-testid="cell-date">
          {dayNumber(cell.day)}
        </span>
        <CardNumber value={dayNumberOf(page)} />
      </span>

      {/* Rule 2 — the title, two lines. */}
      {page === null ? null : (
        <span
          className="rk-cal-label line-clamp-2 min-w-0 text-xs leading-tight"
          data-testid="cell-label"
        >
          {page.title}
        </span>
      )}

      {/* Rules 3 and 4 — the foot: a stage word, or the date's two words. */}
      <span className="mt-auto min-w-0">
        {page !== null ? (
          <StageMark page={page} narrowable />
        ) : line === null ? (
          cell.today ? (
            <span className="block text-[11px] font-semibold text-primary" data-testid="cell-today">
              {copy("calendar.month.today")}
            </span>
          ) : null
        ) : (
          <span
            className="rk-cal-empty block min-w-0 truncate text-[11px] font-semibold opacity-70"
            data-testid={isCause ? "cell-empty-line" : "calendar-horizon-marker"}
          >
            {line}
          </span>
        )}
      </span>
    </button>
  );
}
