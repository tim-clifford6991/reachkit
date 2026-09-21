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
