// SPEC §4 (2026-09-20, #908) — the Rivals tab's handles, and the words each
// one is spoken from.
//
// Two maps, keyed by the closed tuples in `rivals-model.ts`, so a fifth
// status or a fifth column is a compile error here rather than a cell with
// no heading or a badge with no word.
//
// **No sentence is composed here.** Every value is a `CopyKey`; the strings
// are `src/lib/presentation/copy/keys/overview.ts`'s, which is the owner's
// file.
import { Plus, type LucideIcon } from "lucide-react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { RivalSearchStatus } from "./rivals-model";
import { STATUS_ICON } from "./search-words";

export const RIVAL_STATUS_COPY_KEY: Readonly<Record<RivalSearchStatus, CopyKey>> = Object.freeze({
  in_review: "overview.rivals.status.in-review",
  up_next: "overview.rivals.status.up-next",
  needs_page: "overview.rivals.status.needs-page",
  too_big: "overview.rivals.status.too-big",
});

/**
 * The daisyUI badge each status wears.
 *
 * Not `./badges.ts`'s `BADGE`, and for the reason `search-words.ts` already
 * records for its own four: these are not four tones. *Up next* and *needs a
 * page* are both neutral — neither is a success, a warning or an error —
 * and what tells them apart is a daisyUI modifier, not a colour. Painting
 * "needs a page on your main site" red would make an honest statement of
 * work look like a fault. Every badge carries its own word, so no status is
 * colour-alone (§2.5).
 */
export const RIVAL_STATUS_BADGE: Readonly<Record<RivalSearchStatus, string>> = Object.freeze({
  in_review: "badge badge-warning badge-soft",
  up_next: "badge badge-ghost",
  needs_page: "badge badge-outline",
  too_big: "badge badge-outline opacity-70",
});

/** The Google tab's icons for the statuses the two tables share; a search with no page planned is a new page. */
export const RIVAL_STATUS_ICON: Readonly<Record<RivalSearchStatus, LucideIcon>> = Object.freeze({
  in_review: STATUS_ICON.your_review,
  up_next: STATUS_ICON.up_next,
  needs_page: Plus,
  too_big: STATUS_ICON.too_big,
});

/** The table's four columns, in the order SPEC §4 lists them. The tuple is
 *  the set: the header row, the cells and the table's own column model all
 *  read it, so a fifth column is added in one place. */
export const RIVAL_COLUMNS = ["search", "volume", "winner", "doing"] as const;
export type RivalColumn = (typeof RIVAL_COLUMNS)[number];

export const RIVAL_COLUMN_COPY_KEY: Readonly<Record<RivalColumn, CopyKey>> = Object.freeze({
  search: "overview.search.column.search",
  volume: "overview.search.column.volume",
  winner: "overview.rivals.column.winner",
  doing: "overview.rivals.column.doing",
});

/** Below `sm` the row is one column, as the board stacks it: the search, its demand, what we're doing, then who wins it. */
export const RIVAL_CELL_CLASS: Readonly<Record<RivalColumn, string>> = Object.freeze({
  search: "min-w-0",
  volume: "text-sm max-sm:text-base-content/70 sm:text-end",
  winner: "min-w-0 max-sm:order-last",
  doing: "",
});
