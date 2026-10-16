// SPEC §4 (2026-09-20, #908) — the Search tab's four readings.
//
// The searches ReachKit is keeping ready, how many of the live pages have
// reached Google's first two pages, how many of the searches it tracks are
// on Google's first page (issue 1457: the rows the `first_page` chip shows,
// and Overview's Google tile), and every search the site appears for.
//
// **§4's data rule holds on all four**: "every headline number has a
// change, a goal or a denominator." None of them carries a change — no
// previous count of any of these four is stored anywhere, and a change
// computed from a number nobody wrote down would be an invention — so every
// one of them carries its denominator or its goal, which is the half of the
// rule that is always available.
//
// **Every number goes through `renderValue`**, so a reading nobody took is
// the dash and its own written line and never a zero.
//
// **Two lines are this site's own reading** (#1039, board R4-05-Search):
// the queue says how long it lasts, and the first page names the search
// best placed on it. The other two keep the board's fixed line. A dash on
// either of the two says why it is a dash — never the fixed line instead.
//
// **A zero is quiet** (docs/DESIGN.md, the calm layer, #1089). A tile whose
// reading is zero, or was never taken, is a flat grey cell with its number
// at body size, never a white card with a big "0" — a week-0 account used to
// open this tab on four of them. The words are the same; only the weight
// changes, so a live tile beside it is the one the eye finds.
//
// **It cannot overflow.** One column on a phone, two at `sm`, four at
// `xl`; every tile is `min-w-0`, its name is clamped to one line with the
// whole of it on the element's own title, and its figure is never clamped —
// the box changes instead (docs/DESIGN.md's no-overflow rule).
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CLOSED, TILE_FIGURE, TILE_GRID, formatCount, renderValue } from "./present";
import type { SearchTile, SearchTiles as Tiles, TileReading } from "./search-model";

/** A place on the results page, spoken the way the table speaks it. */
function place(position: number): string {
  return copy("overview.search.position", { position: formatCount(position) });
}

/** The site's own reading, as the registry words it. */
function readingLine(r: TileReading): string {
  switch (r.kind) {
    case "queue":
      if (r.weeks >= 2) return copy("overview.search.tile.going-after.weeks", { weeks: formatCount(r.weeks) });
      if (r.days >= 2) return copy("overview.search.tile.going-after.days", { days: formatCount(r.days) });
      return r.days === 1
        ? copy("overview.search.tile.going-after.one-day")
        : copy("overview.search.tile.going-after.none");
    case "first-page":
      return r.others === 0
        ? copy("overview.search.tile.first-page.one", { search: r.search, position: place(r.position) })
        : copy("overview.search.tile.first-page.more", {
            search: r.search,
            position: place(r.position),
            others: formatCount(r.others),
          });
    case "closest":
      return copy("overview.search.tile.first-page.closest", { search: r.search, position: place(r.position) });
    case "no-place":
      return copy("overview.search.tile.first-page.no-place");
  }
}

/** One tile: its name, the number, what the number is read against, and one
 *  line saying what it means — the site's own reading where the tile has
 *  one, the fixed line otherwise. */
function Tile(p: {
  labelKey: CopyKey;
  testId: string;
  tile: SearchTile;
  /** How the denominator is spoken — "of 30 kept ready", "of 17 live
   *  pages", "goal: 400". A key, never a sentence composed here. */
  againstKey: CopyKey;
  meansKey: CopyKey | null;
}): React.JSX.Element {
  const label = copy(p.labelKey);
  const value = renderValue(p.tile.value, p.labelKey);
  const of = renderValue(p.tile.of, p.labelKey);
  const against = of.isDash ? null : copy(p.againstKey, { of: of.text, value: of.text });
  const fixed = p.meansKey === null ? null : copy(p.meansKey);
  const quiet = value.isDash || p.tile.value.kind !== "measured" || p.tile.value.value === 0;
  // /70 ink: the softer 2026-09-25 ink at /60 is under axe's floor even on white.
  const ink = "text-base-content/70";
  const means = value.isDash
    ? (value.line ?? fixed)
    : p.tile.reading === undefined
      ? fixed
      : readingLine(p.tile.reading);

  // The name, the number and what it is read against: what the tile shows
  // closed, and all a tile with nothing to explain ever shows.
  const reading = (
    <>
      {/* The tile's name is the product's own, not the customer's, so it
          wraps rather than being clamped: four fixed phrases, and a name
          cut in half is a name nobody can read (the same ruling
          `LinkedTiles` records for its three). */}
      <span className={`min-w-0 pe-6 text-xs font-semibold uppercase tracking-wide ${ink}`}>
        {label}
      </span>
      {/* A quiet figure and a full one hold the same row, so a tile is one
          height whatever it reads — and the skeleton's too. */}
      <div className={TILE_FIGURE}>
        <span
          className={quiet ? "figure text-base leading-none text-base-content/70" : "figure text-3xl leading-none"}
          data-testid={`${p.testId}-value`}
        >
          {value.text}
        </span>
        {against === null ? null : (
          <span className={`num text-sm ${ink}`}>{against}</span>
        )}
      </div>
    </>
  );
  const sentence =
    means === null ? null : (
      <p className={`text-xs ${ink}`} data-testid={`${p.testId}-means`}>
        {means}
      </p>
    );

  return (
    <section
      className={quiet ? "card min-w-0 bg-base-200" : "card card-border min-w-0 bg-base-100"}
      data-testid={p.testId}
      data-quiet={quiet ? "" : undefined}
    >
      {sentence === null || value.isDash ? (
        // A dash keeps its line in sight: it is the date the number will
        // be, not a sentence about a number (SPEC §4, 2026-09-20).
        <div className="card-body gap-2 p-4">
          {reading}
          {sentence}
        </div>
      ) : (
        // The sentence explains the number, so it is closed under it
        // (SPEC §4, 2026-10-07).
        <details className={CLOSED.root}>
          <summary className={CLOSED.tile}>{reading}</summary>
          <div className={CLOSED.tileBody}>{sentence}</div>
        </details>
      )}
    </section>
  );
}

/** The four tiles, in the order SPEC §4 and the approved board put them:
 *  what is queued, how far the live pages have got, and the whole footprint
 *  behind them. A row rather than four call sites, because every key here
 *  is a registry handle and a handle written as a JSX attribute is a string
 *  literal on a surface — the one thing REQ-093's sweep exists to stop. */
const TILES = [
  {
    id: "goingAfter",
    labelKey: "overview.search.tile.going-after",
    testId: "search-tile-going-after",
    againstKey: "overview.search.tile.going-after.of",
    meansKey: null,
  },
  {
    id: "firstTwoPages",
    labelKey: "overview.search.tile.first-two-pages",
    testId: "search-tile-first-two-pages",
    againstKey: "overview.search.tile.pages.of",
    meansKey: "overview.search.tile.first-two-pages.means",
  },
  {
    id: "firstPage",
    labelKey: "overview.search.tile.first-page",
    testId: "search-tile-first-page",
    againstKey: "overview.search.tile.searches.of",
    meansKey: null,
  },
  {
    // The fourth tile is the Overview's own first tile, read from the same
    // stored count and spoken from the same key: two names for one reading
    // is how two screens come to state two different numbers.
    id: "appearFor",
    labelKey: "overview.tile.searches.label",
    testId: "search-tile-appear-for",
    againstKey: "overview.goal",
    meansKey: "overview.search.tile.appear-for.means",
  },
] as const satisfies readonly {
  id: keyof Tiles;
  labelKey: CopyKey;
  testId: string;
  againstKey: CopyKey;
  meansKey: CopyKey | null;
}[];

export function SearchTiles(p: { tiles: Tiles }): React.JSX.Element {
  return (
    <div className={`grid min-w-0 gap-4 ${TILE_GRID.search}`} data-testid="search-tiles">
      {TILES.map((tile) => (
        <Tile
          key={tile.id}
          labelKey={tile.labelKey}
          testId={tile.testId}
          tile={p.tiles[tile.id]}
          againstKey={tile.againstKey}
          meansKey={tile.meansKey}
        />
      ))}
    </div>
  );
}
