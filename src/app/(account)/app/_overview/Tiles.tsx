// SPEC §4 *Overview's four tiles* — the row of four that heads Overview's
// results and its four details: full on `/app`, compact (and a strip on a
// phone) above a detail. Each tile is one link to the rows it counts.
import type React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, CircleCheck, Search, Sparkles, Users, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { GrowthWeek } from "@/ui/charts/GrowthLine";
import { TileTrend } from "./TileTrend";
import { formatCount, formatDate, formatShortDay } from "../_shell/format";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { Box, Waiting } from "../_shell/skeletons";
import { REGION } from "./frame";
import { AI_WINDOW_WEEKS, type Tile, type TileChange, type TileKey, type TilesModel } from "@/lib/measure/results";
import { changeWords, ofWords, TILE_NAME, TILE_UNREAD } from "@/lib/measure/results-words";

export const TILE_HREF: Readonly<Record<TileKey, string>> = {
  pages: "/app/pages",
  google: "/app/search",
  ai: "/app/ai-answers",
  rivals: "/app/rivals",
};

const ICON: Readonly<Record<TileKey, LucideIcon>> = { pages: CircleCheck, google: Search, ai: Sparkles, rivals: Users };
const SHORT: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.short.pages",
  google: "overview.tile.short.google",
  ai: "overview.tile.short.ai",
  rivals: "overview.tile.short.rivals",
};
const INK = "text-sm text-base-content/70";

const ofLine = (tile: Tile): string => {
  const of = ofWords(tile, formatCount);
  return copy(of.text, of.vars);
};

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

/** The AI tile's hosted-site line: the live pages an AI app read, never merged with mentions or visits. */
const readLine = (x: number): string => (x === 0 ? copy("overview.tile.ai.read.none") : copy("overview.tile.ai.read", { x: formatCount(x) }));

/** On Google's line beneath the of-line; `null` on every other tile. */
function shownLine(tile: Tile, d: TileDates): string | null {
  const s = tile.shown;
  if (s === undefined) return null;
  if (s.kind === "no-console") return copy("overview.tile.google.no-console");
  if (s.kind === "shown") return s.n === 0 ? copy("overview.tile.google.shown.none") : s.n === 1 ? copy("overview.tile.google.shown.one") : copy("overview.tile.google.shown", { n: formatCount(s.n) });
  const date = s.start === null ? null : formatShortDay(new Date(`${s.start}T12:00:00Z`), d.timeZone);
  const c = formatCount(s.visited);
  if (s.visited === 0) return date === null ? copy("overview.tile.google.not-in") : copy("overview.tile.google.counts-start", { date });
  return date === null ? copy("overview.tile.google.visited.not-in", { c }) : copy("overview.tile.google.visited", { c, date });
}

function changeLine(key: TileKey, change: TileChange, d: TileDates): string | null {
  const said = changeWords(key, change, d, { count: formatCount, date: (at) => formatDate(at, d.timeZone), day: (at) => formatShortDay(at, d.timeZone) });
  return said === null ? null : copy(said.text, said.vars);
}

function Trend(p: { tile: Tile; bars: TilesModel["bars"] }): React.JSX.Element | null {
  if (p.tile.key === "rivals") {
    if (p.bars === null) return null;
    return <TileTrend you={{ name: copy("report.you"), value: p.bars.you }} rivals={p.bars.rivals} measured={p.bars.of} label={copy("overview.tile.rivals.name")} />;
  }
  const series = p.tile.series;
  if (series === null || series.every((v) => v === null)) return null;
  const unread = copy("overview.tile.change.unread", { what: copy(TILE_UNREAD[p.tile.key]) });
  const weeks = series.map((value, i): GrowthWeek => (value === null ? { name: String(i), value: null, account: unread, cuts: true } : { name: String(i), value }));
  return <TileTrend weeks={weeks as [GrowthWeek, ...GrowthWeek[]]} />;
}

const CARD = "card card-border h-full w-full bg-base-100";
/** A card that opens another screen lifts; the current tile opens this one, so it does not move. */
const LIFT = `${CARD_LIFT} hover:border-primary`;
/** The detail strip: 2×2 on a narrow phone, so no fixed name is cut, then one row. */
const STRIP = "grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3";

/** The full row: `/app`, after the head and today's page. */
export function Tiles(p: { model: TilesModel; dates: TileDates }): React.JSX.Element {
  return (
    <nav className="min-w-0" aria-label={copy("overview.tiles.label")} data-testid="overview-tiles">
      <ul className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" data-frame={REGION.tiles}>
        {p.model.tiles.map((tile) => {
          const Icon = ICON[tile.key];
          const change = tile.change === null ? null : changeLine(tile.key, tile.change, p.dates);
          const shown = shownLine(tile, p.dates);
          return (
            <li key={tile.key} className="flex min-w-0">
              <Link className={`${CARD} ${LIFT}`} href={TILE_HREF[tile.key]} prefetch={true} data-testid={`overview-tile-${tile.key}`}>
                <span className="card-body min-w-0 gap-1.5 p-3 sm:p-5">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">{copy(TILE_NAME[tile.key])}</span>
                    <ChevronRight className="ms-auto hidden size-4 shrink-0 text-base-content/50 sm:block" aria-hidden />
                  </span>
                  <Figure tile={tile} className="text-3xl leading-snug font-semibold tabular-nums" />
                  <span className={`${INK} break-words`}>{ofLine(tile)}</span>
                  {shown === null ? null : <span className={`${INK} break-words`}>{shown}</span>}
                  {tile.key === "ai" && p.model.aiRead != null ? <span className={INK}>{readLine(p.model.aiRead)}</span> : null}
                  {change === null ? null : (
                    <span className={`text-sm ${tile.change?.kind === "up" ? "text-success" : "text-base-content/70"}`}>{change}</span>
                  )}
                  <Trend tile={tile} bars={p.model.bars} />
                  <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-semibold text-primary">
                    {copy("overview.tile.see")}
                    <ArrowRight className={`size-4 ${ARROW_NUDGE}`} aria-hidden />
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
      <BackToOverview />
      {p.model === null ? null : (
        <nav className="min-w-0" aria-label={copy("overview.tiles.label")} data-testid="overview-tiles">
          <ul className={STRIP} data-frame={REGION.detailTiles}>
            {p.model.tiles.map((tile) => {
              const here = tile.key === p.tab;
              const Icon = ICON[tile.key];
              return (
                <li key={tile.key} className="flex min-w-0">
                  <Link
                    className={`${CARD} ${here ? "border-primary" : LIFT}`}
                    href={TILE_HREF[tile.key]}
                    prefetch={true}
                    aria-current={here ? "page" : undefined}
                    data-testid={`overview-tile-${tile.key}`}
                  >
                    <span className="card-body min-h-11 min-w-0 justify-center gap-0.5 p-2 text-center text-sm lg:hidden">
                      <span>{copy(SHORT[tile.key])}</span>
                      <Figure tile={tile} className="font-semibold tabular-nums" />
                    </span>
                    <span className="card-body hidden min-w-0 gap-1 p-3 lg:flex">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">{copy(TILE_NAME[tile.key])}</span>
                      </span>
                      <Figure tile={tile} className="text-xl leading-snug font-semibold tabular-nums" />
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

function BackToOverview(): React.JSX.Element {
  return (
    <Link className="link link-hover inline-flex min-h-11 w-fit items-center text-sm" href="/app" prefetch={true}>
      {copy("chrome.back-to-overview")}
    </Link>
  );
}

/** A detail while it loads: the same link and strip, so nothing moves when the detail arrives. */
export function DetailTilesSkeleton(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <BackToOverview />
      <Waiting testId="detail-tiles-skeleton" className={STRIP} frame={REGION.detailTiles}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} className="h-14 w-full lg:h-24" />
        ))}
      </Waiting>
    </div>
  );
}

/** The closed account of what each tile counts. */
export function TilesHow(p: { hosted: boolean; noConsole: boolean }): React.JSX.Element {
  return (
    <details className="collapse collapse-arrow card-border min-w-0 bg-base-100" data-testid="overview-tiles-how">
      <summary className="collapse-title font-semibold">{copy("overview.tiles.how.title")}</summary>
      <div className="collapse-content flex flex-col gap-2 text-sm">
        <p>{copy("overview.tiles.how.pages")}</p>
        <p>{copy("overview.tiles.how.google")}</p>
        {p.noConsole ? <p>{copy("overview.tiles.how.google.no-console")}</p> : null}
        <p>{copy("overview.tiles.how.ai", { weeks: formatCount(AI_WINDOW_WEEKS) })}</p>
        {p.hosted ? <p>{copy("overview.tiles.how.ai.read")}</p> : null}
        <p>{copy("overview.tiles.how.rivals")}</p>
        <p>{copy("overview.tiles.how.change")}</p>
      </div>
    </details>
  );
}
