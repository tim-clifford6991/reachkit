// SPEC §7 (2026-09-20, #908, issue 930) — the parts a day draws, shared by
// Plan's week rows (`WeekGrid`) and Overview's week cards: the page a stage
// filter leaves, the two words an empty day says, the New or Update chip,
// the state badge, and Overview's day card itself.
//
// The clamped title carries `rk-cal-label` and the two-word reason
// `rk-cal-empty` — the truncations this screen declared to the layout sweep
// in #354.
import type React from "react";
import { Calendar, CircleStop, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { PageSketch } from "@/ui/PageSketch";
import { copy } from "@/lib/presentation/copy";
import { horizonShortFor, shortCauseFor } from "./card-lines";
import { dayNumber, weekdayShort } from "./dates";
import { dayStateOf, type DayCell, type PageOnDay } from "./month";
import { DAY_STATE_COPY_KEY, DAY_STATE_TONE, TONE_BADGE, type DayState, type StageFilter } from "./stages";

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

/** What a page is, as the board's chip: New, or Update. */
export function KindChip(p: { update: boolean }): React.JSX.Element {
  const Icon = p.update ? RefreshCw : Plus;
  return (
    <span className="badge badge-sm badge-soft badge-primary shrink-0 gap-1 font-semibold" data-testid="day-kind">
      <Icon aria-hidden className="size-3" />
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
}): React.JSX.Element | null {
  const { cell, page } = p;
  if (page !== null) {
    const today = cell.today && p.goesLive !== null && (page.stage === "your_review" || page.stage === "scheduled");
    return (
      <>
        {page.whyLine === null ? null : (
          <span className="flex min-w-0 flex-col" data-testid="cell-why">
            <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{copy("calendar.week.why")}</span>
            <span className="min-w-0 text-xs wrap-anywhere" data-testid="cell-why-line">
              {page.whyLine}
            </span>
          </span>
        )}
        {today ? (
          <span className="min-w-0 text-xs font-semibold" data-testid="cell-goes-live">
            {copy("calendar.week.today", { time: p.goesLive! })}
          </span>
        ) : null}
      </>
    );
  }
  if (p.filtered) return null;
  const line = cell.empty?.cause === "page_cannot_go_live" ? "calendar.day.stopped.line" : p.firstSkip ? "calendar.day.skipped.line" : null;
  return line === null ? null : (
    <span className="min-w-0 text-xs wrap-anywhere text-base-content/70" data-testid="cell-state-line">
      {copy(line)}
    </span>
  );
}

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

/** One day as a card: its date, its page's sketch, chip and title
 *  or the empty day's two words, its lines, then `controls`. Overview's week draws it. */
export function DayCardView(p: {
  cell: DayCell;
  page: PageOnDay | null;
  line: string | null;
  goesLive: string | null;
  firstSkip: boolean;
  filtered: boolean;
  selected: boolean;
  controls: React.ReactNode;
}): React.JSX.Element {
  const { cell, page, line } = p;
  const day = (
    <>
      <span className="num shrink-0 text-xs font-semibold" data-testid="cell-date">
        {weekdayShort(cell.day)} {dayNumber(cell.day)}
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
      <DayLines cell={cell} page={page} goesLive={p.goesLive} firstSkip={p.firstSkip} filtered={p.filtered} />
    </>
  );
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
        <div className="flex min-w-0 flex-col gap-1">{day}</div>
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1">{p.controls}</div>
      </div>
    </li>
  );
}
