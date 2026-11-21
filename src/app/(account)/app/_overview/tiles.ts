// SPEC §4 *Overview's four tiles* — each tile's figure, its change on the week
// before and its 6-week series, from stored rows. Pure; a week no healthy pass
// read is a gap, never 0.
import { addressOf, linkedByIn, ownPlaceIn, searchRowsFor, type PlaceReport } from "@/lib/measure/page-reading";

export const TILE_KEYS = ["pages", "google", "ai", "rivals"] as const;
export type TileKey = (typeof TILE_KEYS)[number];

/** The weeks a tile's line draws. */
export const TILE_WEEKS = 6;
/** At most 12 page questions are asked a week, so AI is read over four. */
export const AI_WINDOW_WEEKS = 4;
const WEEK_MS = 7 * 86_400_000;

/** One weekly pass: its Monday, when it ran, whether its health checks passed, and its report. */
export interface TilePass {
  weekStart: string;
  at: string;
  healthy: boolean;
  report: PlaceReport;
  /** The main searches it put the site on Google's first page for; `null` where it read none. */
  firstPage: number | null;
}

/** One publication ever published. */
export interface TilePage {
  id: string;
  liveUrl: string | null;
  publishedAt: string;
  unpublishedAt: string | null;
  /** The search its place is read on. */
  search: string | null;
  /** Its stored reading holds a place this week. */
  placed: boolean;
}

export type TileChange =
  | { kind: "up" | "down"; n: number }
  | { kind: "same" }
  | { kind: "first"; at: Date }
  | { kind: "unread" }
  | { kind: "due" }
  | { kind: "start"; at: Date }
  | { kind: "coming"; n: number }
  | { kind: "golive" };

export interface Tile {
  key: TileKey;
  /** `null` is not counted yet, drawn as a dash. */
  n: number | null;
  /** The "of" line: a count, not counted yet, or no live page yet. */
  of: { kind: "count"; m: number } | { kind: "due" } | { kind: "none" };
  change: TileChange | null;
  /** Oldest first; `null` is a week with no healthy pass. Absent on Competitors. */
  series: readonly (number | null)[] | null;
}

export interface RivalBars {
  you: number;
  rivals: readonly { name: string; value: number }[];
  of: number;
}

export interface TilesModel {
  tiles: readonly Tile[];
  bars: RivalBars | null;
}

/** What Competitors reads from the Competitors screen's own selector. */
export interface RivalsFirstPage {
  you: number;
  of: number;
  rivals: readonly { domain: string; count: number }[];
  measuredAt: Date | null;
}

const isLive = (page: TilePage, t: number): boolean =>
  page.liveUrl !== null && Date.parse(page.publishedAt) <= t && (page.unpublishedAt === null || Date.parse(page.unpublishedAt) > t);

/** The pages live at `t`, one per address. */
function liveAt(pages: readonly TilePage[], t: number): Map<string, TilePage> {
  const out = new Map<string, TilePage>();
  for (const page of pages) if (isLive(page, t)) out.set(addressOf(page.liveUrl!), page);
  return out;
}

function diff(now: number, before: number): TileChange {
  return now > before ? { kind: "up", n: now - before } : now < before ? { kind: "down", n: before - now } : { kind: "same" };
}

/** The Monday `k` weeks before `week`. */
function weeksBefore(week: string, k: number): string {
  return new Date(Date.parse(`${week}T12:00:00Z`) - k * WEEK_MS).toISOString().slice(0, 10);
}

/** Against the healthy pass before the latest: unread where the latest is not healthy, first where none came before. */
function weeklyChange(passes: readonly TilePass[], now: number, value: (pass: TilePass) => number | null): TileChange {
  const latest = passes.at(-1)!;
  if (!latest.healthy) return { kind: "unread" };
  const prior = passes.slice(0, -1).filter((pass) => pass.healthy && value(pass) !== null).at(-1);
  return prior === undefined ? { kind: "first", at: new Date(latest.at) } : diff(now, value(prior)!);
}

/** A week's value over the window's weeks; a week no healthy pass read is a gap. */
function seriesOf(passes: readonly TilePass[], week: string, value: (pass: TilePass) => number | null): (number | null)[] {
  return Array.from({ length: TILE_WEEKS }, (_, i) => {
    const pass = passes.find((p) => p.weekStart === weeksBefore(week, TILE_WEEKS - 1 - i));
    return pass?.healthy === true ? value(pass) : null;
  });
}

/** The live pages a pass put on Google for their own search, as the stored reading counts a place. */
function placedIn(pass: TilePass, pages: readonly TilePage[]): number {
  let n = 0;
  for (const page of liveAt(pages, Date.parse(pass.at)).values()) {
    if (page.search === null) continue;
    const rows = searchRowsFor(pass.report, page.search, { tracked: false });
    if (rows.kind !== "unmeasured" && ownPlaceIn(rows.value, [page.liveUrl!]) !== null) n += 1;
  }
  return n;
}

/** The pages asked over the 4 weeks ending at `week`, and those an answer linked. */
export function aiWindowOf(passes: readonly TilePass[], pages: readonly TilePage[], week: string): { asked: Set<string>; linked: Set<string> } {
  const from = weeksBefore(week, AI_WINDOW_WEEKS - 1);
  const asked = new Set<string>();
  const linked = new Set<string>();
  for (const pass of passes) {
    if (!pass.healthy || pass.weekStart < from || pass.weekStart > week) continue;
    for (const [address, page] of liveAt(pages, Date.parse(pass.at))) {
      const by = linkedByIn(pass.report, page.id, page.liveUrl!);
      if (by === null) continue;
      asked.add(address);
      if (by.length > 0) linked.add(address);
    }
  }
  return { asked, linked };
}

export function tilesOf(a: {
  passes: readonly TilePass[];
  pages: readonly TilePage[];
  rivals: RivalsFirstPage | null;
  now: Date;
  /** This site-local week's Monday. */
  week: string;
  /** Pages planned to go live later this week. */
  coming: number;
  /** A page is set to go live. */
  goLive: boolean;
}): TilesModel {
  const passes = [...a.passes].sort((x, y) => x.weekStart.localeCompare(y.weekStart));
  const t = a.now.getTime();
  const live = liveAt(a.pages, t);
  const latest = passes.at(-1);

  // Pages: every address ever published, merged and taken-down ones included.
  const ever = new Set(a.pages.map((page) => (page.liveUrl === null ? `#${page.id}` : addressOf(page.liveUrl))));
  const weekly = Array.from({ length: TILE_WEEKS }, (_, i) => liveAt(a.pages, t - (TILE_WEEKS - 1 - i) * WEEK_MS).size);
  const lastWeek = weekly.at(-2)!;
  const firstLive = [...live.values()].map((page) => page.publishedAt).sort()[0];
  const pages: Tile =
    live.size === 0
      ? { key: "pages", n: 0, of: { kind: "none" }, change: a.goLive ? { kind: "golive" } : null, series: null }
      : {
          key: "pages",
          n: live.size,
          of: { kind: "count", m: ever.size },
          change:
            latest === undefined
              ? a.coming > 0 ? { kind: "coming", n: a.coming } : null
              : lastWeek === 0 ? { kind: "first", at: new Date(firstLive!) } : diff(live.size, lastWeek),
          series: weekly,
        };

  const none = (key: TileKey): Tile => ({ key, n: null, of: { kind: "none" }, change: null, series: null });
  const due = (key: TileKey): Tile => ({ key, n: null, of: { kind: "due" }, change: { kind: "due" }, series: null });

  // On Google: the figure is the stored readings'; the weeks before are rebuilt from their reports.
  const placed = [...live.values()].filter((page) => page.placed).length;
  const googleValue = (pass: TilePass): number => (pass === latest ? placed : placedIn(pass, a.pages));
  const google: Tile =
    live.size === 0
      ? none("google")
      : latest === undefined
        ? due("google")
        : {
            key: "google",
            n: placed,
            of: { kind: "count", m: live.size },
            change: weeklyChange(passes, placed, googleValue),
            series: seriesOf(passes, a.week, googleValue),
          };

  // Linked by AI: the pages asked over the last 4 weeks, and those an answer linked.
  const aiValue = (pass: TilePass): number => aiWindowOf(passes, a.pages, pass.weekStart).linked.size;
  const window = latest === undefined ? null : aiWindowOf(passes, a.pages, latest.weekStart);
  const ai: Tile =
    live.size === 0
      ? none("ai")
      : window === null || window.asked.size === 0
        ? due("ai")
        : {
            key: "ai",
            n: window.linked.size,
            of: { kind: "count", m: window.asked.size },
            change: weeklyChange(passes, window.linked.size, aiValue),
            series: seriesOf(passes, a.week, aiValue),
          };

  // Against Competitors: the Competitors screen's own count; the week before is the pass before.
  const r = a.rivals;
  const rivals: Tile =
    r === null || r.of === 0
      ? due("rivals")
      : {
          key: "rivals",
          n: r.you,
          of: { kind: "count", m: r.of },
          change:
            latest === undefined
              ? r.measuredAt === null ? null : { kind: "start", at: r.measuredAt }
              : weeklyChange(passes, r.you, (pass) => pass.firstPage),
          series: null,
        };

  const bars =
    r === null || r.of === 0
      ? null
      : {
          you: r.you,
          of: r.of,
          rivals: [...r.rivals].sort((x, y) => y.count - x.count).slice(0, 2).map((row) => ({ name: row.domain, value: row.count })),
        };

  return { tiles: [pages, google, ai, rivals], bars };
}
