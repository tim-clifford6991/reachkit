// SPEC §7 (2026-09-20, #908, issue 930) — "a day with no page says why in
// at most two words; the day panel carries the full reason", and "every
// card has a full aria-label".
//
// Both are decisions about words, so both are made here rather than in the
// card's JSX: the card renders what it is handed and composes nothing.
//
// **The short form is not a truncated long form.** `empty.ts` already
// decides *which* cause a date has (`accountFor`, one fixed precedence,
// total); what is new is that each cause now has two written forms — the
// two-word hint a card has room for, and the account the panel states. Two
// words cannot be a sentence cut in half, so they are two keys, and the map
// below is total over the cause union: a cause added to `EmptyAccount`
// fails to compile here rather than drawing a blank word on a card.
//
// **A card's label is the card's facts, in the owner's punctuation.** A
// screen reader meets the date as a bare numeral, the stage as a word next
// to a coloured dot and the title as a clamped line; read out in document
// order that is three fragments. The label states the same three as one
// sentence, from a registry key with slots — never joined with literals
// here, because the full stops a reader pauses on are copy.
import type { CopyKey } from "@/lib/presentation/copy";
import { copy } from "@/lib/presentation/copy";
import type { PlanReason, PointPart } from "@/lib/opportunities/types";
import { writtenLine } from "../_shell/written";
import { cardDate } from "./dates";
import type { EmptyCause } from "./empty";
import { STAGE_FILTER_COPY_KEY } from "./stages";
import type { DayCell, PageOnDay } from "./month";

/**
 * The ≤2-word form of every cause, total over the union.
 *
 * `unattributed` has its own key (SPEC §7, 2026-10-07, issue 1321): a day
 * says ReachKit stopped only where a stop is recorded for it.
 *
 * The three held-by-setting arms share one too. The long forms differ
 * because each names the setting and where to change it; at two words they
 * would all be "Held back", so they are one key rather than three copies of
 * one string.
 */
export const EMPTY_SHORT_COPY_KEY: Readonly<Record<EmptyCause, CopyKey>> = Object.freeze({
  instruction: "calendar.empty.short.instruction",
  reachkit_stopped: "calendar.empty.short.reachkit-stopped",
  page_cannot_go_live: "calendar.empty.short.page-cannot-go-live",
  customer_change_holds_pages: "calendar.empty.short.customer-change-holds-pages",
  change_holds_generation: "calendar.empty.short.change-holds-pages",
  page_held: "calendar.empty.short.page-held",
  supply_unmeasured: "calendar.empty.short.supply-unmeasured",
  supply_exhausted: "calendar.empty.short.supply-exhausted",
  unattributed: "calendar.empty.short.unexplained",
});

/**
 * The two words a card states for a date with no page, or `null` where it
 * states none.
 *
 * It states none in three cases, and each is a rule from somewhere else:
 * the cell was not given the line at all (`statesLine`, issue 857 — supply
 * is stated once at the top of the screen and a law cause on the first
 * empty date in the plan only); a stage filter is on, so "no page of this
 * stage here" is not "nothing was worth publishing here" (REQ-043 c3); or
 * the date is past the plan horizon and carries the quiet marker instead.
 */
export function shortCauseFor(cell: DayCell): string | null {
  if (cell.page !== null || cell.empty === null || !cell.statesLine) return null;
  return writtenLine(EMPTY_SHORT_COPY_KEY[cell.empty.cause]);
}

/** Issue 857's quiet marker, in the room a card has: the first date past
 *  the horizon that holds no page. The panel states the full line. */
export function horizonShortFor(cell: DayCell): string | null {
  return cell.horizonMarker ? writtenLine("calendar.horizon.short") : null;
}

/**
 * The whole label of one card.
 *
 * Three shapes, because a card has three. A date the screen has nothing to
 * say about still gets its date read out — a button with no accessible
 * name is a button nobody can reach.
 */
export function cardLabel(a: {
  cell: DayCell;
  /** The page the card is actually drawing — the cell's, unless a stage
   *  filter has hidden it. */
  page: PageOnDay | null;
  /** The line the card is actually drawing, where it draws one — so the
   *  label says what is on the card and never a reason the card withheld. */
  line: string | null;
}): string {
  const date = cardDate(a.cell.day);
  const page = a.page;
  if (page !== null) {
    return copy("calendar.card.aria.page", {
      date,
      stage: copy(STAGE_FILTER_COPY_KEY[page.stage]),
      title: page.title,
    });
  }
  if (a.line !== null) return copy("calendar.card.aria.empty", { date, reason: a.line });
  return copy("calendar.card.aria.date", { date });
}

/** What a page is: an update of a page the site already has, or a new one
 *  (SPEC §7, 2026-09-20 — "a mark for an update"). One word, from the
 *  registry, used as the mark's own label and as the panel's chip. */
export function kindWord(update: boolean): string {
  return copy(update ? "calendar.card.update" : "calendar.card.new-page");
}

/** The parts a page's why line can state, most specific first. */
const WHY_LINE: readonly { part: PointPart; n?: number; key: CopyKey }[] = [
  { part: "near_page_one", key: "calendar.week.why.near-page-one" },
  { part: "not_moving", key: "calendar.week.why.not-moving" },
  { part: "ai_gap", key: "calendar.week.why.ai-gap" },
  { part: "linked_by_ai", key: "calendar.week.why.linked-by-ai" },
  { part: "demand", n: 2, key: "calendar.week.why.searched" },
  { part: "demand", n: 1, key: "calendar.week.why.asked" },
  { part: "fit", n: 3, key: "calendar.week.why.fit" },
];

/** A page's one why line, from the reason the week stored for it, or
 *  `null` where none is stored or no part says more than the fit. */
export function whyLineOf(reason: PlanReason | null | undefined): string | null {
  const parts = reason?.parts ?? [];
  const found = WHY_LINE.find((line) => parts.some((part) => part.part === line.part && (line.n === undefined || part.n === line.n)));
  return found === undefined ? null : writtenLine(found.key);
}
