// SPEC §7 (2026-09-20, #908, issue 930) — the parts a day draws, shared by
// Plan's week rows (`WeekGrid`) and Overview's week (`ThisWeek`): the page a
// stage filter leaves, the two words an empty day says, the New or Update
// chip and the state badge.
//
// The clamped title carries `rk-cal-label` and the two-word reason
// `rk-cal-empty` — the truncations this screen declared to the layout sweep
// in #354.
import type React from "react";
import { Calendar, CircleStop, Plus, RefreshCw, type LucideIcon } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE } from "@/lib/presentation/site-issues";
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
  const short = shortCauseFor(cell);
  // A day waiting on the customer's own fix names that fix, in place of its two words.
  if (short !== null && cell.empty?.cause === "instruction") return copy("calendar.day.held-for-fix", { fix: copy(SITE_CHECK_TITLE[cell.empty.check]) });
  return short ?? horizonShortFor(cell);
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

/** What a day with no page says in its place: the day the customer stopped, else the week's first skip. */
export function stateLineOf(cell: DayCell, firstSkip: boolean): string | null {
  if (cell.empty?.cause === "page_cannot_go_live") return copy("calendar.day.stopped.line", { day: `${weekdayShort(cell.day)} ${dayNumber(cell.day)}` });
  return firstSkip ? copy("calendar.day.skipped.line") : null;
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
