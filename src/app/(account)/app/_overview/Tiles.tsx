// SPEC §4 *Overview's four tiles* — the row of four that heads Overview's
// results and its four details: full on `/app`, compact (and a strip on a
// phone) above a detail. Each tile is one link to the rows it counts.
import type React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, CircleCheck, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { GrowthLine, type GrowthWeek } from "@/ui/charts/GrowthLine";
import { PresenceBars } from "@/ui/charts/PresenceBars";
import { formatCount, formatDate, formatShortDay } from "../_shell/format";
import { REGION } from "./frame";
import type { Tile, TileChange, TileKey, TilesModel } from "./tiles";

/** Pages Live opens This Week's live pages until its own screen is built. */
export const TILE_HREF: Readonly<Record<TileKey, string>> = {
  pages: "/app/calendar#published",
  google: "/app/search",
  ai: "/app/ai-answers",
  rivals: "/app/rivals",
};

const ICON: Readonly<Record<TileKey, LucideIcon>> = { pages: CircleCheck, google: Search, ai: Sparkles, rivals: Users };
const NAME: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.pages.name",
  google: "overview.tile.google.name",
  ai: "overview.tile.ai.name",
  rivals: "overview.tile.rivals.name",
};
const SHORT: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.short.pages",
  google: "overview.tile.short.google",
  ai: "overview.tile.short.ai",
  rivals: "overview.tile.short.rivals",
};
const OF: Readonly<Record<Exclude<TileKey, "pages">, CopyKey>> = {
  google: "overview.tile.google.of",
  ai: "overview.tile.ai.of",
  rivals: "overview.tile.rivals.of",
};
const NONE_OF: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.pages.none.of",
  google: "overview.tile.google.none.of",
  ai: "overview.tile.google.none.of",
  rivals: "overview.tile.due.of",
};
/** What a week that could not be checked names. */
const UNREAD: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.short.google",
  google: "overview.tile.short.google",
  ai: "overview.tile.unread.ai",
  rivals: "overview.tile.short.google",
};
const INK = "text-sm text-base-content/70";

export interface TileDates {
  /** The next Monday's check. */
  due: Date;
  /** The next page's go-live. */
  goLive: Date | null;
  timeZone: string;
}

function Figure(p: { tile: Tile; className: string }): React.JSX.Element {
  return p.tile.n === null ? (
    <span className={p.className}>
      <span aria-hidden>{copy("unmeasured.dash")}</span>
      <span className="sr-only">{copy("overview.tile.due.sr")}</span>
    </span>
  ) : (
    <span className={p.className}>{formatCount(p.tile.n)}</span>
  );
}

function ofLine(tile: Tile): string {
  if (tile.of.kind === "due") return copy("overview.tile.due.of");
  if (tile.of.kind === "none") return copy(NONE_OF[tile.key]);
  const m = formatCount(tile.of.m);
  return tile.key === "pages" ? copy("overview.tile.pages.of", { total: m }) : copy(OF[tile.key], { m });
}

function changeLine(key: TileKey, change: TileChange, d: TileDates): string | null {
  switch (change.kind) {
    case "up":
      return copy("overview.tile.change.up", { n: formatCount(change.n) });
    case "down":
      return copy("overview.tile.change.down", { n: formatCount(change.n) });
    case "same":
      return copy("overview.tile.change.same");
    case "first":
      return copy("overview.tile.change.first", { date: formatDate(change.at, d.timeZone) });
    case "unread":
      return copy("overview.tile.change.unread", { what: copy(UNREAD[key]) });
    case "due":
      return copy("overview.tile.due.change", { date: formatShortDay(d.due, d.timeZone) });
    case "start":
      return copy("overview.tile.rivals.start", { date: formatDate(change.at, d.timeZone) });
    case "coming":
      return copy("overview.tile.pages.coming", { n: formatCount(change.n) });
    case "golive":
      return d.goLive === null ? null : copy("overview.tile.pages.none.change", { day: formatShortDay(d.goLive, d.timeZone) });
  }
}

function Trend(p: { tile: Tile; bars: TilesModel["bars"] }): React.JSX.Element | null {
  if (p.tile.key === "rivals") {
    if (p.bars === null) return null;
    return (
      <span className="hidden md:block" aria-hidden>
        <PresenceBars
          you={{ name: copy("report.you"), value: p.bars.you }}
          rivals={p.bars.rivals}
          measured={p.bars.of}
          label={copy("overview.tile.rivals.name")}
        />
      </span>
    );
  }
  const series = p.tile.series;
  if (series === null || series.every((v) => v === null)) return null;
  const unread = copy("overview.tile.change.unread", { what: copy(UNREAD[p.tile.key]) });
  const weeks = series.map((value, i): GrowthWeek => (value === null ? { name: String(i), value: null, account: unread, cuts: true } : { name: String(i), value }));
  return (
    <span className="hidden md:block">
      <GrowthLine weeks={weeks as [GrowthWeek, ...GrowthWeek[]]} compact />
    </span>
  );
}

const CARD = "card card-border h-full w-full bg-base-100 transition-[translate,border-color] duration-200 hover:border-primary motion-safe:hover:-translate-y-0.5";

/** The full row: `/app`, after the head and today's page. */
export function Tiles(p: { model: TilesModel; dates: TileDates }): React.JSX.Element {
  return (
    <nav className="min-w-0" aria-label={copy("overview.tiles.label")} data-testid="overview-tiles">
      <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" data-frame={REGION.tiles}>
        {p.model.tiles.map((tile) => {
          const Icon = ICON[tile.key];
          const change = tile.change === null ? null : changeLine(tile.key, tile.change, p.dates);
          return (
            <li key={tile.key} className="flex min-w-0">
              <Link className={`${CARD} group`} href={TILE_HREF[tile.key]} prefetch={true} data-testid={`overview-tile-${tile.key}`}>
                <span className="card-body min-w-0 gap-1.5 p-4">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">{copy(NAME[tile.key])}</span>
                    <ChevronRight className="ms-auto size-4 shrink-0 text-base-content/50" aria-hidden />
                  </span>
                  <Figure tile={tile} className="text-3xl font-semibold tabular-nums" />
                  <span className={INK}>{ofLine(tile)}</span>
                  {change === null ? null : (
                    <span className={`text-sm ${tile.change?.kind === "up" ? "text-success" : "text-base-content/70"}`}>{change}</span>
                  )}
                  <Trend tile={tile} bars={p.model.bars} />
                  <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-primary">
                    {copy("overview.tile.see")}
                    <ArrowRight className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-[3px]" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Above a detail: *Back to Overview*, then the compact row at `lg` and a strip below it. */
export function DetailTiles(p: { model: TilesModel | null; tab: TileKey }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Link className="link link-hover inline-flex min-h-11 w-fit items-center text-sm" href="/app" prefetch={true}>
        {copy("chrome.back-to-overview")}
      </Link>
      {p.model === null ? null : (
        <nav className="min-w-0" aria-label={copy("overview.tiles.label")} data-testid="overview-tiles">
          <ul className="grid min-w-0 grid-cols-4 gap-2 lg:gap-3">
            {p.model.tiles.map((tile) => {
              const here = tile.key === p.tab;
              const Icon = ICON[tile.key];
              return (
                <li key={tile.key} className="flex min-w-0">
                  <Link
                    className={`${CARD} ${here ? "border-primary" : ""}`}
                    href={TILE_HREF[tile.key]}
                    prefetch={true}
                    aria-current={here ? "page" : undefined}
                    data-testid={`overview-tile-${tile.key}`}
                  >
                    <span className="card-body min-h-11 min-w-0 justify-center gap-0.5 p-2 text-center text-sm lg:hidden">
                      <span className="truncate">{copy(SHORT[tile.key])}</span>
                      <Figure tile={tile} className="font-semibold tabular-nums" />
                    </span>
                    <span className="card-body hidden min-w-0 gap-1 p-3 lg:flex">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">{copy(NAME[tile.key])}</span>
                      </span>
                      <Figure tile={tile} className="text-xl font-semibold tabular-nums" />
                      <span className={INK}>{ofLine(tile)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** The closed account of what each tile counts. */
export function TilesHow(): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid="overview-tiles-how">
      <summary className="collapse-title font-semibold">{copy("overview.tiles.how.title")}</summary>
      <div className="collapse-content flex flex-col gap-2 text-sm">
        <p>{copy("overview.tiles.how.pages")}</p>
        <p>{copy("overview.tiles.how.google")}</p>
        <p>{copy("overview.tiles.how.ai")}</p>
        <p>{copy("overview.tiles.how.rivals")}</p>
        <p>{copy("overview.tiles.how.change")}</p>
      </div>
    </details>
  );
}
