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
// **Nothing here speaks.** The four status words, the four column heads and
// the tile names are the registry's (`search-words.ts` holds the handles).
// The depth §7 keeps ready is a pin, imported and never restated: a change
// to a pin moves the screen, and a change to the screen cannot move a pin.
// The fourth tile's goal is read through `./goals.ts`, which is the one
// file in this directory allowed to name the goal pins — the pairing lives
// there and the numbers live in the constants, and this screen reads
// neither a second time.
import { SUPPLY_TARGET_DEPTH } from "@/lib/config/constants";
import { GOALS } from "./goals";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
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
 *  `first_page` is the searches Google shows the site on its first page.
 *  `live` is the rows Overview's Google tile counts (issue 1551), so the
 *  tile opens exactly them. */
export const SEARCH_FILTERS = ["all", "first_page", ...SEARCH_STATUSES] as const;
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

/** A headline number and the one thing it is read against. SPEC §4: "every
 *  headline number has a change, a goal or a denominator." Both arms below
 *  are a denominator or a goal, so a tile cannot be constructed bare. */
export interface SearchTile {
  value: Measured<number>;
  /** What the number is out of — the live pages counted, or the depth the
   *  product keeps ready. */
  of: Measured<number>;
  /** What the number says about **this** site, in the board's shape
   *  (#1039) — absent where the tile's line is a fixed one, and where the
   *  number was not measured: a dash says why, never a generality. */
  reading?: TileReading;
}

/**
 * The site's own reading under a tile, as facts; the tile speaks them.
 *
 * `queue` is how long the kept-ready searches last at §7's one page a day,
 * in whole weeks once there are two of them and in days before that.
 * `pages` splits the live pages' searches into the first page, places
 * 11–100 and not yet seen (issue 1551).
 */
export type TileReading =
  | { kind: "queue"; weeks: number; days: number }
  | { kind: "pages"; firstPage: number; further: number; unseen: number };

export interface SearchTiles {
  /** Open, ready, non-Fix rows — days of pages the product holds
   *  (`supplyDepth`), out of `SUPPLY_TARGET_DEPTH`. */
  goingAfter: SearchTile;
  /** The searches the live pages target that Google shows the site for at
   *  places 1–100, out of all of them, split first page · 11–100 · not yet
   *  seen (owner, 2026-10-19, issue 1551) — `yourPages`, the rows the
   *  `live` chip shows and Overview's Google tile counts. */
  pages: SearchTile;
  /** Your market: the twelve searches the market sizes the site against,
   *  on which it holds a first-page place — the stored presence card's own
   *  count. A months-scale outcome, said so on the tile (issue 1551). */
  market: SearchTile;
  /** Every search the site appears for at any position — the current
   *  report's own `ownRanked` — against the product's goal. */
  appearFor: SearchTile;
}

export interface SearchModel {
  /** The rows, already in the screen's one order (below). */
  rows: readonly SearchRow[];
  /** How many rows each chip stands for, `all` included. Counted over the
   *  whole set, once, so the chips and the table can never disagree. */
  counts: Readonly<Record<SearchFilter, number>>;
  tiles: SearchTiles;
  /** The difficulty ceiling this site is judged against **today** — what
   *  the mark on every bar stands at. `null` where the site's ranked count
   *  was never measured, and the line above the table is then not drawn at
   *  all rather than drawn against a ceiling nobody computed. */
  ceiling: number | null;
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
  /** Live, non-unpublished publications this site holds. Unmeasured where
   *  they could not be read, and the pages tile is then the dash. */
  livePages: Measured<number>;
  /** Open, ready, non-Fix rows — `supplyDepth().unused`. */
  ready: Measured<number>;
  /** The whole site's ranked count from the current stored report. */
  ownRanked: Measured<number>;
  /** The twelve market searches the current report measured, and how many
   *  the site holds a first-page place on (`presence.you.top10Count`).
   *  `null` where the report holds no presence card. */
  market: { top10: number; measured: number } | null;
  ceiling: number | null;
  measuredAt: Date | null;
}

export interface SearchTargetFacts {
  id: string;
  target: SearchTarget;
  status: SearchStatus;
  rival: SearchRival | null;
  change: PositionChange;
}

/** A count, as one of the three arms rather than a bare integer: a zero the
 *  screen counted is a measurement (`zero`), and it is not the same fact as
 *  a count it could not take. */
function counted(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
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
    position: facts.positions.get(fact.target.search) ?? unmeasured<number>("not_attempted", at),
    change: fact.change,
    rival: fact.rival,
    status: fact.status,
  }));

  rows.sort((a, b) => closeness(a) - closeness(b) || demandOf(b) - demandOf(a) || a.id.localeCompare(b.id));

  const firstPage = onFirstPage(rows);
  const counts = {
    all: rows.length,
    first_page: firstPage.length,
    live: rows.filter((row) => row.status === "live").length,
    your_review: rows.filter((row) => row.status === "your_review").length,
    up_next: rows.filter((row) => row.status === "up_next").length,
    too_big: rows.filter((row) => row.status === "too_big").length,
  } satisfies Record<SearchFilter, number>;

  // Issue 1551: the pages tile counts the searches the live pages target,
  // so the figure moves with the work published, never with the market's
  // biggest searches. No scan, or no live page read: not a zero.
  const pages = yourPages(rows);
  const seen = pages.filter((row) => row.position.kind !== "unmeasured" && row.position.value <= DEEPEST_PLACE);
  const pagesRead = facts.measuredAt !== null && facts.livePages.kind !== "unmeasured";
  const firstPageCount = seen.filter((row) => onPage(row.position)).length;

  return {
    rows,
    counts,
    tiles: {
      goingAfter: {
        value: facts.ready,
        of: measured(SUPPLY_TARGET_DEPTH, at),
        reading: facts.ready.kind === "unmeasured" ? undefined : queueReading(facts.ready.value),
      },
      pages: pagesRead
        ? {
            value: counted(seen.length, at),
            of: counted(pages.length, at),
            reading: { kind: "pages", firstPage: firstPageCount, further: seen.length - firstPageCount, unseen: pages.length - seen.length },
          }
        : { value: unmeasured<number>("not_attempted", at), of: unmeasured<number>("not_attempted", at) },
      market:
        facts.market === null
          ? { value: unmeasured<number>("not_attempted", at), of: unmeasured<number>("not_attempted", at) }
          : { value: counted(facts.market.top10, at), of: counted(facts.market.measured, at) },
      appearFor: { value: facts.ownRanked, of: measured(GOALS.searches_appeared_in.value, at) },
    },
    ceiling: facts.ceiling,
    measuredAt: facts.measuredAt,
  };
}

/** §7: at most one page a day, so every kept-ready search is a day. */
const DAYS_A_WEEK = 7;

/** How long `ready` searches last. Whole weeks only, rounded down — "the
 *  next five weeks" is a promise, and a promise is never rounded up. */
export function queueReading(ready: number): TileReading {
  return { kind: "queue", weeks: Math.floor(ready / DAYS_A_WEEK), days: ready };
}

/** Google's first page — ten results is what "the first page" means to the
 *  customer — and the deepest place a ranked row reports. Named here so
 *  neither number is a literal in a filter. */
export const FIRST_PAGE = 10 as const;
export const DEEPEST_PLACE = 100 as const;

/** Whether a place is on Google's first page. */
function onPage(position: Measured<number> | undefined): boolean {
  return position !== undefined && position.kind !== "unmeasured" && position.value <= FIRST_PAGE;
}

/** The searches Google shows the site on its first page for: the rows the
 *  `first_page` chip shows. */
export function onFirstPage(rows: readonly SearchRow[]): readonly SearchRow[] {
  return rows.filter((row) => onPage(row.position));
}

/** The searches the live pages target (issue 1551). One selector: the
 *  Google tab's pages tile, its `live` chip and Overview's Google tile all
 *  count these rows. */
export function yourPages(rows: readonly SearchRow[]): readonly SearchRow[] {
  return rows.filter((row) => row.status === "live");
}

/** The rows one chip stands for — the rows the table draws. */
export function rowsFor(rows: readonly SearchRow[], filter: SearchFilter): readonly SearchRow[] {
  if (filter === "all") return rows;
  if (filter === "first_page") return onFirstPage(rows);
  return rows.filter((row) => row.status === filter);
}
