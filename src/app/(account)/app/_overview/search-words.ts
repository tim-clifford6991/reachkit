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
import { Calendar, CircleCheck, CircleMinus, Clock, Clock4, List, RefreshCw, TrendingUp, type LucideIcon } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { Doing, SearchFilter, SearchStatus } from "./search-model";

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

/** The icon each status draws before its word: one icon per concept across the product. */
export const STATUS_ICON: Readonly<Record<SearchStatus, LucideIcon>> = Object.freeze({
  live: CircleCheck,
  your_review: Clock,
  up_next: List,
  too_big: CircleMinus,
});

/** The badge a cell wears for what is done this week: a day's page or update
 *  wears the scheduled colour, a page left alone to climb the live one. */
export const DOING_BADGE: Readonly<Record<Exclude<Doing["kind"], "status">, string>> = Object.freeze({
  today: STATUS_BADGE.your_review,
  page: STATUS_BADGE.your_review,
  update: STATUS_BADGE.your_review,
  climbing: STATUS_BADGE.live,
});

/** The icon each badge for what is done this week wears, as the board draws it. */
export const DOING_ICON: Readonly<Record<Exclude<Doing["kind"], "status">, LucideIcon>> = Object.freeze({
  today: Clock4,
  page: Calendar,
  update: RefreshCw,
  climbing: TrendingUp,
});

/** The table's five columns, in the board's order. The tuple is
 *  the set: the header row, the cells and the table's own column model all
 *  read it, so a column is added in one place. */
export const SEARCH_COLUMNS = [
  "search",
  "volume",
  "you",
  "rival",
  "status",
] as const;
export type SearchColumn = (typeof SEARCH_COLUMNS)[number];

export const COLUMN_COPY_KEY: Readonly<Record<SearchColumn, CopyKey>> = Object.freeze({
  search: "overview.search.column.search",
  volume: "overview.search.column.volume",
  you: "overview.search.column.you",
  rival: "overview.search.column.rival",
  status: "overview.search.column.status",
});

/** Below `sm` the row is the board's three lines: the search and your place, its demand and who shows, then what we're doing. */
export const SEARCH_CELL_CLASS: Readonly<Record<SearchColumn, string>> = Object.freeze({
  search: "min-w-0 max-sm:col-span-2 max-sm:row-start-1",
  volume: "max-sm:col-start-1 max-sm:row-start-2 max-sm:text-sm max-sm:text-base-content/70 max-sm:after:content-['·']",
  you: "max-sm:col-start-3 max-sm:row-start-1 max-sm:justify-self-end",
  rival: "min-w-0 max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:text-base-content/70",
  status: "max-sm:col-span-3 max-sm:row-start-3",
});

/** The heads a phone still draws over the stacked rows, as the board does. */
export const PHONE_HEADS: ReadonlySet<SearchColumn> = new Set(["search", "you"]);
