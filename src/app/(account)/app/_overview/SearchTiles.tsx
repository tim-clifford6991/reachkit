// SPEC §4 (board AppGoogle) — the Google tab's three readings: how many live
// pages Google shows, the visits Google sent them this week, and your
// market's searches on Google's first page. Each tile is its name, figure and
// what the figure is read against, with "What this means" closed under it.
//
// **A figure nothing measured says "not measured"**, never 0 (REQ-004): the
// pages the weekly reading has not reached yet, a site whose visits cannot be
// counted (WordPress keeps no server logs), a report with no market card.
//
// **A zero is quiet** (docs/DESIGN.md, the calm layer, #1089): a flat grey
// cell with its figure at body size, so a live tile beside it is the one the
// eye finds.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { CLOSED, TILE_FIGURE, TILE_GRID, formatCount } from "./present";
import type { GooglePages } from "./google-pages";
import type { MarketTile } from "./search-model";
import type { VisitWeek } from "@/lib/publish/reads/model";
import { ReadsBars } from "@/ui/charts/ReadsBars";
import { shortDay } from "./Figures";

const INK = "text-base-content/70";
const VISITS_CHART = copy("overview.search.visits.chart");

export interface TileText {
  testId: string;
  label: string;
  figure: string;
  quiet: boolean;
  against: string | null;
  split: string | null;
  means: string;
  /** The figure drawn, under it: its weeks, or its share. */
  spark?: React.ReactNode;
}

export function Tile(p: TileText): React.JSX.Element {
  return (
    <section
      className={p.quiet ? "card min-w-0 bg-base-200" : "card card-border min-w-0 bg-base-100"}
      data-testid={p.testId}
      data-quiet={p.quiet ? "" : undefined}
    >
      <details className={CLOSED.root}>
        <summary className={CLOSED.tile}>
          <span className={`min-w-0 pe-6 text-xs font-semibold uppercase tracking-wide ${INK}`}>{p.label}</span>
          <div className={TILE_FIGURE}>
            <span
              className={p.quiet ? `figure text-base leading-none ${INK}` : "figure text-3xl leading-none"}
              data-testid={`${p.testId}-value`}
            >
              {p.figure}
            </span>
            {p.against === null ? null : <span className={`num num-phrase min-w-0 text-sm ${INK}`}>{p.against}</span>}
          </div>
          {p.spark}
          {p.split === null ? null : (
            <span className={`text-xs ${INK}`} data-testid={`${p.testId}-split`}>
              {p.split}
            </span>
          )}
          <span className="text-xs font-semibold">{copy("overview.means")}</span>
        </summary>
        <div className={CLOSED.tileBody}>
          <p className={`text-xs ${INK}`} data-testid={`${p.testId}-means`}>
            {p.means}
          </p>
        </div>
      </details>
    </section>
  );
}

export const NOT_MEASURED = { figure: copy("draft.ladder.unmeasured"), quiet: true, against: null, split: null } as const;

function visitsSpark(weeks: readonly VisitWeek[]): React.ReactNode {
  if (weeks.length < 2) return null;
  return (
    <ReadsBars
      label={VISITS_CHART}
      weeks={weeks.map((week) => ({ name: shortDay(new Date(`${week.start}T12:00:00Z`), "UTC"), count: week.visits }))}
    />
  );
}

export function SearchTiles(p: {
  pages: GooglePages | null;
  /** Visits from Google per week, oldest first; `null` where they cannot be counted. */
  visits: readonly VisitWeek[] | null;
  market: MarketTile | null;
}): React.JSX.Element {
  const { pages, market } = p;
  const visits = p.visits === null ? null : (p.visits.at(-1)?.visits ?? 0);
  const tiles: TileText[] = [
    {
      testId: "search-tile-pages",
      label: copy("overview.search.tile.your-pages"),
      means: copy("overview.search.tile.your-pages.means"),
      ...(pages === null || pages.read === 0
        ? NOT_MEASURED
        : {
            figure: formatCount(pages.showing),
            quiet: pages.showing === 0,
            against: copy("overview.search.tile.your-pages.of", { of: formatCount(pages.read) }),
            split: [
              copy("overview.search.tile.your-pages.split", {
                first: formatCount(pages.firstPage),
                further: formatCount(pages.showing - pages.firstPage),
                unseen: formatCount(pages.read - pages.showing),
              }),
              ...(pages.live === pages.read ? [] : [copy("overview.ladder.unread", { k: formatCount(pages.live - pages.read) })]),
            ].join(" · "),
          }),
    },
    {
      testId: "search-tile-visits",
      label: copy("overview.search.visits.label"),
      means: copy("overview.search.visits.means"),
      ...(visits === null
        ? NOT_MEASURED
        : p.visits?.length === 0
          ? { figure: copy("overview.search.visits.none"), quiet: true, against: null, split: null }
          : {
              figure: formatCount(visits),
              quiet: visits === 0,
              against: copy("overview.search.visits.of"),
              split: null,
              spark: visitsSpark(p.visits ?? []),
            }),
    },
    {
      testId: "search-tile-market",
      label: copy("overview.search.tile.market"),
      means: copy("overview.search.tile.market.means"),
      ...(market === null
        ? NOT_MEASURED
        : {
            figure: formatCount(market.top10),
            quiet: market.top10 === 0,
            against: copy("overview.search.tile.searches.of", { of: formatCount(market.of) }),
            split: copy("overview.search.tile.market.split", {
              first: formatCount(market.top10),
              rest: formatCount(market.of - market.top10),
            }),
          }),
    },
  ];
  return (
    <div className={`grid min-w-0 gap-4 ${TILE_GRID.search}`} data-testid="search-tiles">
      {tiles.map((tile) => (
        <Tile key={tile.testId} {...tile} />
      ))}
    </div>
  );
}
