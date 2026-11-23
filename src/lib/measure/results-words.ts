// SPEC §4 *Overview's four tiles* — each tile's name, "of" line and change line as copy keys, so Overview
// and the Monday mail say every state in the same words; each surface brings its own number and date formats.
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { AI_WINDOW_WEEKS, type Tile, type TileChange, type TileKey } from "./results";

export interface Said {
  text: CopyKey;
  vars?: Record<string, string>;
}

export interface TileFormat {
  count(n: number): string;
  /** A first count's or a starting point's date. */
  date(at: Date): string;
  /** The next check's or the next go-live's day. */
  day(at: Date): string;
}

export const TILE_NAME: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.pages.name",
  google: "overview.tile.google.name",
  ai: "overview.tile.ai.name",
  visits: "overview.tile.visits.name",
};
const OF: Readonly<Record<"google" | "ai", CopyKey>> = {
  google: "overview.tile.google.of",
  ai: "overview.tile.ai.of",
};
const NONE_OF: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.pages.none.of",
  google: "overview.tile.google.none.of",
  ai: "overview.tile.google.none.of",
  visits: "overview.tile.visits.due",
};
/** What a week that could not be checked names. */
export const TILE_UNREAD: Readonly<Record<TileKey, CopyKey>> = {
  pages: "overview.tile.short.google",
  google: "overview.tile.short.google",
  ai: "overview.tile.unread.ai",
  visits: "overview.tile.unread.visits",
};

export function ofWords(tile: Tile, f: Pick<TileFormat, "count" | "date">): Said {
  const of = tile.of;
  switch (of.kind) {
    case "due":
      return { text: "overview.tile.due.of" };
    case "none":
      return { text: NONE_OF[tile.key] };
    case "unread":
      return { text: "overview.tile.change.unread", vars: { what: copy(TILE_UNREAD[tile.key]) } };
    case "wordpress":
      return { text: "overview.tile.visits.wordpress" };
    case "window":
      return of.since === null ? { text: "overview.tile.visits.of" } : { text: "overview.tile.visits.since", vars: { date: f.date(of.since) } };
  }
  const m = f.count(of.m);
  if (tile.key === "google" && (of.u ?? 0) > 0) return { text: "overview.tile.google.of.unchecked", vars: { m, u: f.count(of.u!) } };
  if (tile.key === "pages") return { text: "overview.tile.pages.of", vars: { total: m } };
  return { text: OF[tile.key === "ai" ? "ai" : "google"], vars: { m, n: m, weeks: f.count(AI_WINDOW_WEEKS) } };
}

/** `due` is the next Monday's check; `goLive` the next page's go-live, `null` where none is set. */
export function changeWords(key: TileKey, change: TileChange, d: { due: Date; goLive: Date | null }, f: TileFormat): Said | null {
  const said = changeOf(key, change, d, f);
  const moved = "moved" in change ? (change.moved ?? 0) : 0;
  if (said === null || moved === 0) return said;
  const inner = copy(said.text, said.vars);
  return moved === 1 ? { text: "overview.tile.change.moved.one", vars: { change: inner } } : { text: "overview.tile.change.moved", vars: { change: inner, n: f.count(moved) } };
}

function changeOf(key: TileKey, change: TileChange, d: { due: Date; goLive: Date | null }, f: TileFormat): Said | null {
  switch (change.kind) {
    case "up":
      return { text: "overview.tile.change.up", vars: { n: f.count(change.n) } };
    case "down":
      return { text: "overview.tile.change.down", vars: { n: f.count(change.n) } };
    case "same":
      return { text: "overview.tile.change.same" };
    case "first":
      return { text: "overview.tile.change.first", vars: { date: f.date(change.at) } };
    case "unread":
      return { text: "overview.tile.change.unread", vars: { what: copy(TILE_UNREAD[key]) } };
    case "due":
      return { text: "overview.tile.due.change", vars: { date: f.day(d.due) } };
    case "coming":
      return { text: "overview.tile.pages.coming", vars: { n: f.count(change.n) } };
    case "golive":
      return d.goLive === null ? null : { text: "overview.tile.pages.none.change", vars: { day: f.day(d.goLive) } };
  }
}
