// SPEC §4 (2026-09-20, #908) — the Search tab, in one shape.
//
// "Search tab: every search ReachKit is going after — searches a month,
// difficulty against the site's ceiling, the site's position and change,
// the best rival and its position, and status (page is live · your review ·
// up next · too big for now). Read from stored opportunities, the site's
// own ranked keywords and the weekly verdicts; nothing is bought for the
// screen."
//
// **This file is pure.** Facts in, model out — the same split `model.ts`
// makes for the Overview tab, and for the same reason: every rule below is
// then decided by a test with no database and no browser. Reading the facts
// is `search-store.ts`'s (a real account) and `search-fixture.ts`'s (the
// reserved fixture account).
//
// **Every number is a `Measured<T>`** and reaches the screen through
// `present.ts`'s `renderValue`, so a reading nobody took renders as the
// dash with its own line and never as a zero. That is REQ-004's promise and
// it is the reason a row carries `Measured<number>` where a position would
// otherwise be a `number | null`: `null` cannot say *why*.
//
// **Nothing here speaks.** The status words and the column heads are the
// registry's (`search-words.ts` holds the handles).
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { PageTarget } from "../_shell/page-target";

/**
 * SPEC §4's four, in the order the screen ranks them: a page is live, it is
 * waiting for the customer, it is planned, or the search is outsized for
 * the site today (`unready_reason = 'outsized'`, SPEC §6's right-sizing
 * law). Closed — a fifth is a requirement change, not a new member, and
 * `Record<SearchStatus, …>` below makes one a compile error in three places
 * at once.
 */
export const SEARCH_STATUSES = ["live", "your_review", "up_next", "too_big"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

/** The chips over the table: `all` is a filter and never a status, which is
 *  why it is a separate tuple rather than a fifth `SearchStatus` — the same
 *  shape, and the same reason, as the calendar's `STAGE_FILTERS`.
 *  `live` is the rows Overview's Google figure links to (issue 1551). */
export const SEARCH_FILTERS = ["all", ...SEARCH_STATUSES] as const;
export type SearchFilter = (typeof SEARCH_FILTERS)[number];

/**
 * What one row states about its search, narrowed from the one-page
 * projection both other screens read.
 *
 * A `Pick` of `PageTarget` rather than four fields spelled again: the
 * calendar day panel, the draft screen and this table state the same facts
 * about the same stored evidence, and a second projection is how they would
 * come to disagree. A member renamed there is a compile error here.
 */
export type SearchTarget = Pick<
  PageTarget,
  "search" | "volume" | "difficulty" | "ceiling" | "winnability"
>;

/**
 * The week's change in places, as the stored verdict recorded it.
 *
 * `places` is **how many places the page moved**, always positive, with
 * `better` saying which way — never a signed number a renderer has to know
 * the sign convention of (a search position is better the smaller it is,
 * which is the convention every arithmetic mistake on this screen would be
 * made of). `first` is a page with a verdict and nothing recorded to
 * compare it with: its first week, which is a fact and not a zero.
 */
export type PositionChange =
  | { kind: "moved"; places: number; better: boolean }
  | { kind: "first" }
  | { kind: "none" };

/** The best rival on this search, as the pass copied it onto the row. */
export interface SearchRival {
  domain: string;
  position: Measured<number>;
}

/** One row of the table — one stored opportunity. */
export interface SearchRow {
  /** The opportunity's own id. The row's key, and the one thing on it that
   *  is never drawn. */
  id: string;
  target: SearchTarget;
  /** Where the site stands on this search today, from the current stored
   *  report's own ranked rows. Unmeasured where the site holds no place in
   *  them — which is a place it does not hold, not a place it holds at 0. */
  position: Measured<number>;
  change: PositionChange;
  /** `null` for an Improve target: the page that answers this search is the
   *  customer's own, so no rival holds it. */
  rival: SearchRival | null;
  status: SearchStatus;
}

/** Your market: of the twelve searches the market sizes the site against,
 *  those on which it holds a first-page place — the stored presence card's
 *  own count. `null` where the report holds no presence card. */
export interface MarketTile {
  top10: number;
  of: number;
}

export interface SearchModel {
  /** The rows, already in the screen's one order (below). */
  rows: readonly SearchRow[];
  /** How many rows each chip stands for, `all` included. Counted over the
   *  whole set, once, so the chips and the table can never disagree. */
  counts: Readonly<Record<SearchFilter, number>>;
  market: MarketTile | null;
  /** The date the positions and the ranked count were measured, for the
   *  line that says when. `null` where the site has no readable report. */
  measuredAt: Date | null;
}

/** Everything the Search tab reads, before it is a model. */
export interface SearchFacts {
  /** One entry per opportunity the product is going after, in any order:
   *  the projection, the stored status, the rival and what the weekly
   *  verdict recorded. */
  targets: readonly SearchTargetFacts[];
  /** The site's own place for each search it ranks for, keyed by the search
   *  — the current stored report's `ownRankedRows`, projected. A search
   *  absent from the map is one the site holds no place for. */
  positions: ReadonlyMap<string, Measured<number>>;
  /** The twelve market searches the current report measured, and how many
   *  the site holds a first-page place on (`presence.you.top10Count`).
   *  `null` where the report holds no presence card. */
  market: { top10: number; measured: number } | null;
  measuredAt: Date | null;
}

export interface SearchTargetFacts {
  id: string;
  target: SearchTarget;
  status: SearchStatus;
  rival: SearchRival | null;
  change: PositionChange;
  /** A live page's own reading of its place, which wins over `positions`. */
  position?: Measured<number>;
}

/**
 * The screen's one order: **what is closest to the first page**.
 *
 * A row the site already holds a place for sorts by that place, ascending —
 * nothing is closer to page one than being on page two. A row it holds no
 * place for cannot be ordered by a place it has none of, so it sorts after
 * every row that has one, by status (a live page is further along than a
 * page in review, which is further along than one not yet written) and then
 * by the difficulty it faces, easiest first. Volume breaks the last tie,
 * biggest first: of two equally hard searches nobody has started, the one
 * more people ask is the nearer prize.
 *
 * Deterministic to the last key, because the table is paged nine at a time:
 * a tie broken differently on two renders is nine different rows.
 */
const STATUS_ORDER: Readonly<Record<SearchStatus, number>> = Object.freeze({
  live: 0,
  your_review: 1,
  up_next: 2,
  too_big: 3,
});

/** The sort key, as one number per row, so the table's own sorted row model
 *  orders on a column rather than on a comparator nobody can see. Smaller
 *  is closer to the first page. */
export function closeness(row: SearchRow): number {
  if (row.position.kind !== "unmeasured") return row.position.value;
  // Every row with no place sorts after every row with one. The offset is
  // larger than any search position a vendor reports, so the two ranges
  // cannot interleave however deep a position goes.
  const UNPLACED = 1_000;
  const difficulty = row.target.difficulty.kind === "unmeasured" ? 100 : row.target.difficulty.value;
  return UNPLACED + STATUS_ORDER[row.status] * 200 + difficulty;
}

/** The last tie-break, applied after `closeness`: more searches a month
 *  first. Separate from `closeness` because it runs the other way, and a
 *  single number cannot carry two directions honestly. */
function demandOf(row: SearchRow): number {
  return row.target.volume.kind === "unmeasured" ? 0 : row.target.volume.value;
}

export function assembleSearch(facts: SearchFacts, at: Date): SearchModel {
  const rows: SearchRow[] = facts.targets.map((fact) => ({
    id: fact.id,
    target: fact.target,
    position: fact.position ?? facts.positions.get(fact.target.search) ?? unmeasured<number>("not_attempted", at),
    change: fact.change,
    rival: fact.rival,
    status: fact.status,
  }));

  rows.sort((a, b) => closeness(a) - closeness(b) || demandOf(b) - demandOf(a) || a.id.localeCompare(b.id));

  const counts = {
    all: rows.length,
    live: rows.filter((row) => row.status === "live").length,
    your_review: rows.filter((row) => row.status === "your_review").length,
    up_next: rows.filter((row) => row.status === "up_next").length,
    too_big: rows.filter((row) => row.status === "too_big").length,
  } satisfies Record<SearchFilter, number>;

  return {
    rows,
    counts,
    market: facts.market === null ? null : { top10: facts.market.top10, of: facts.market.measured },
    measuredAt: facts.measuredAt,
  };
}

/** The rows one chip stands for — the rows the table draws. */
export function rowsFor(rows: readonly SearchRow[], filter: SearchFilter): readonly SearchRow[] {
  return filter === "all" ? rows : rows.filter((row) => row.status === filter);
}

/** What ReachKit is doing about one search this week (board AppGoogle):
 *  its page or its update on a day of Plan's week, a live page left alone
 *  while it climbs, or else the row's own status word. */
export type Doing =
  | { kind: "status" }
  | { kind: "today" }
  | { kind: "page"; day: string }
  | { kind: "update"; day: string }
  | { kind: "climbing" };

/** A page on a day of Plan's week, by the search it targets. `day` is the
 *  day as the cell names it ("Tue 20"). */
export interface Planned {
  day: string;
  today: boolean;
  update: boolean;
}

/** The key two readers of one search agree on. */
export function searchKey(search: string): string {
  return search.trim().toLowerCase().replace(/\s+/g, " ");
}

export function doingOf(
  row: SearchRow,
  planned: ReadonlyMap<string, Planned>,
  climbing: ReadonlySet<string>
): Doing {
  const key = searchKey(row.target.search);
  const page = planned.get(key);
  if (page !== undefined) {
    if (page.today) return { kind: "today" };
    return page.update ? { kind: "update", day: page.day } : { kind: "page", day: page.day };
  }
  return row.status === "live" && climbing.has(key) ? { kind: "climbing" } : { kind: "status" };
}
