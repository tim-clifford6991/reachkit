// SPEC §4 (2026-09-20, #908) — the Search tab's handles, and the words each
// one is spoken from.
//
// Three maps, keyed by the closed tuples in `search-model.ts`, so a fifth
// status or a seventh column is a compile error here rather than a cell
// with no heading or a chip with no word.
//
// **No sentence is composed here.** Every value is a `CopyKey`; the strings
// are `src/lib/presentation/copy/keys/overview.ts`'s, which is the owner's
// file. The one thing this module decides that is not a word is which
// daisyUI badge a status wears — see below for why that is not `BADGE`'s
// job.
import type { CopyKey } from "@/lib/presentation/copy";
import type { SearchFilter, SearchStatus } from "./search-model";

export const STATUS_COPY_KEY: Readonly<Record<SearchStatus, CopyKey>> = Object.freeze({
  live: "overview.search.status.live",
  your_review: "overview.search.status.your-review",
  up_next: "overview.search.status.up-next",
  too_big: "overview.search.status.too-big",
});

/** The chips, `all` included. Spelled as its own map rather than
 *  `STATUS_COPY_KEY` plus a special case: `all` is a filter and has no row
 *  in the status map, and a lookup that falls back is a lookup that can
 *  fall back wrongly. */
export const FILTER_COPY_KEY: Readonly<Record<SearchFilter, CopyKey>> = Object.freeze({
  all: "overview.search.status.all",
  live: "overview.search.status.live",
  your_review: "overview.search.status.your-review",
  up_next: "overview.search.status.up-next",
  too_big: "overview.search.status.too-big",
});

/**
 * The daisyUI badge each status wears.
 *
 * **Not `./badges.ts`'s `BADGE`, and deliberately.** That map is `Tone` →
 * badge, and these four are not four tones: *up next* and *too big for now*
 * are both neutral — neither is a success, a warning or an error — and what
 * tells them apart on the approved board is a daisyUI modifier (`ghost`
 * against `outline`), not a colour. Forcing a fourth tone on to "too big
 * for now" would paint an honest statement red. Every badge still carries
 * its own word, so no status is colour-alone (§2.5).
 */
export const STATUS_BADGE: Readonly<Record<SearchStatus, string>> = Object.freeze({
  live: "badge badge-success badge-soft",
  your_review: "badge badge-warning badge-soft",
  up_next: "badge badge-ghost",
  too_big: "badge badge-outline",
});

/** The table's six columns, in the order SPEC §4 lists them. The tuple is
 *  the set: the header row, the cells and the table's own column model all
 *  read it, so a seventh column is added in one place. */
export const SEARCH_COLUMNS = [
  "search",
  "volume",
  "difficulty",
  "you",
  "rival",
  "status",
] as const;
export type SearchColumn = (typeof SEARCH_COLUMNS)[number];

export const COLUMN_COPY_KEY: Readonly<Record<SearchColumn, CopyKey>> = Object.freeze({
  search: "overview.search.column.search",
  volume: "overview.search.column.volume",
  difficulty: "overview.search.column.difficulty",
  you: "overview.search.column.you",
  rival: "overview.search.column.rival",
  status: "overview.search.column.status",
});

/**
 * Where each cell sits **below `sm`**, when the row is a three-line grid
 * rather than a table row (#963).
 *
 * Six columns do not fit a 390px card — measured while proving #958, the
 * card is 358px and the table 802px, so *Difficulty*, *You*, *Best rival*
 * and *Status* all sat off the right edge of the scroller and a phone user
 * saw a search and its volume. A value off the edge of a scroller is one a
 * phone never shows.
 *
 * So the row stacks, in the order #963 asks for: the search and its demand,
 * then where you stand against the best rival, then the difficulty and the
 * status. The table's own column order is search · volume · difficulty ·
 * you · rival · status, which is **not** that order — so each cell is
 * placed explicitly rather than left to the grid's flow. Every class is
 * `max-sm:`, so the six-column table from `sm` up is untouched.
 */
/** A labelled cell puts its word **above** the value on the phone shape,
 *  not beside it. Beside it, the label and the value share one 10rem
 *  column, and `Best rival capterra.com #2` is 200px of it — measured, the
 *  value then escaped its own cell seven rows over. Above it, the value has
 *  the whole column. */
const STACKED = "max-sm:flex-col max-sm:items-start max-sm:gap-0";

export const SEARCH_CELL_CLASS: Readonly<Record<SearchColumn, string>> = Object.freeze({
  search: "min-w-0 max-sm:col-start-1 max-sm:row-start-1",
  volume: "max-sm:col-start-2 max-sm:row-start-1 max-sm:justify-self-end max-sm:text-end",
  difficulty: `min-w-0 max-sm:col-start-1 max-sm:row-start-3 ${STACKED}`,
  you: `min-w-0 max-sm:col-start-1 max-sm:row-start-2 ${STACKED}`,
  rival: `min-w-0 max-sm:col-start-2 max-sm:row-start-2 ${STACKED}`,
  status: "max-sm:col-start-2 max-sm:row-start-3",
});

/**
 * The word that says what a value is, on the phone shape only.
 *
 * The column heads belong to the table and are not drawn below `sm`, so a
 * value that does not say what it is needs the head beside it instead:
 * `#14` alone is not "where you stand" and `#2` alone is not "where the
 * best rival stands". The search is the row's own subject and the status is
 * a word already, so neither is labelled twice.
 *
 * Every one of these is the column's **own** key. No new sentence is minted
 * for the phone — the screen says the same words in a different shape.
 */
export const SEARCH_CELL_LABEL: Readonly<Record<SearchColumn, CopyKey | null>> = Object.freeze({
  search: null,
  volume: null,
  difficulty: COLUMN_COPY_KEY.difficulty,
  you: COLUMN_COPY_KEY.you,
  rival: COLUMN_COPY_KEY.rival,
  status: null,
});
