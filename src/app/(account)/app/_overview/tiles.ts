// SPEC §4 *Overview's four tiles* — each tile's figure, its change on the week
// before and its 6-week series, from stored rows. Pure; a week no healthy pass
// read is a gap, never 0.
import { addressOf, linkedByIn, type PlaceReport } from "@/lib/measure/page-reading";
import { standingAt } from "@/lib/measure/published";
import { classifyReferences, namesOrLinks, namesSite as textNamesSite } from "@/lib/measure/drivers";
import { newestSet } from "@/lib/market/prompts/rate";
import type { PromptsSection } from "@/lib/scan/report";
import type { GoogleShown } from "./google-pages";

export const TILE_KEYS = ["pages", "google", "ai", "rivals"] as const;
export type TileKey = (typeof TILE_KEYS)[number];

/** The weeks a tile's line draws. */
export const TILE_WEEKS = 6;
/** AI answers are pooled over four weeks, so the sample is large enough to read. */
export const AI_WINDOW_WEEKS = 4;
const WEEK_MS = 7 * 86_400_000;

/** One weekly pass: its Monday, when it ran, whether its health checks passed, and its report. */
export interface TilePass {
  weekStart: string;
  at: string;
  healthy: boolean;
  report: PlaceReport;
  /** Each main search it asked: whether it put the site on Google's first page, `null` where its top ten was not read; `null` where it read none. */
  firstPage: ReadonlyMap<string, boolean | null> | null;
  /** Its tracked buyer prompts; absent or `null` where it asked none. */
  prompts?: PromptsSection | null;
}

/** One publication ever published. */
export interface TilePage {
  id: string;
  liveUrl: string | null;
  publishedAt: string;
  unpublishedAt: string | null;
  /** The search its place is read on. */
  search: string | null;
  /** That search's searches a month; `null` where never measured. */
  volume?: number | null;
  /** The first reading it was on Google (`onGoogleSince`); `null` where none was. */
  onGoogle?: string | null;
}

/** This week's counts, taken by the functions that build the lists the tiles open. */
export interface TileLists {
  /** The rows of This Week's *Live pages* (`contentOf`). */
  live: number;
  /** The first one's go-live, for a first count. */
  firstLive: Date | null;
  /** `googlePagesOf`: the live pages, those on Google, those not checked yet, and the line beneath. */
  google: { live: number; on: number; unchecked: number; shown: GoogleShown };
}

export type TileChange =
  | { kind: "up" | "down"; n: number; moved?: number }
  | { kind: "same"; moved?: number }
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
  /** The "of" line: a count (with the pages not checked yet, on Google), not counted yet, or no live page yet. */
  of: { kind: "count"; m: number; u?: number } | { kind: "due" } | { kind: "none" };
  /** On Google's line beneath the of-line. */
  shown?: GoogleShown;
  change: TileChange | null;
  /** Oldest first; `null` is a week with no healthy pass. Absent on Competitors. */
  series: readonly (number | null)[] | null;
}

export interface RivalBars {
  you: number;
  rivals: readonly { name: string; value: number }[];
  of: number;
}

/** The addresses Linked by AI counts over its weeks: `aiPagesFor` turns them into the rows every AI count is taken from. */
export interface AiWindow {
  weeks: number;
  asked: readonly string[];
  linked: readonly string[];
  /** Asked, never linked, and an answer named the site. */
  mentioned: readonly string[];
}

/** `/app/search`'s *Your Market* card: the Against Competitors count itself, so the card and the strip above it say one number. */
export function marketOf(model: TilesModel | null): { top10: number; of: number } | null {
  const tile = model?.tiles.find((t) => t.key === "rivals");
  return tile?.n == null || tile.of.kind !== "count" ? null : { top10: tile.n, of: tile.of.m };
}

export interface TilesModel {
  tiles: readonly Tile[];
  bars: RivalBars | null;
  /** On a hosted site: AI engines' fetches of its pages and visits from AI over the days kept; absent off one. */
  aiOpened?: { fetches: number; visits: number } | null;
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

function diff(now: number, before: number): Extract<TileChange, { kind: "up" | "down" | "same" }> {
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

/** The rows standing at `at`, one per publication, as the live list counts them. */
const standing = (pages: readonly TilePage[], at: number): TilePage[] => pages.filter((page) => standingAt(page, new Date(at)));

/** The pages standing at a pass that were on Google by then; `null` before any page's first count, so those weeks are gaps. */
function onGoogleIn(pass: TilePass, pages: readonly TilePage[]): number | null {
  const at = Date.parse(pass.at);
  const since = pages.flatMap((page) => (page.onGoogle == null ? [] : [Date.parse(page.onGoogle)]));
  if (since.length === 0 || Math.min(...since) > at) return null;
  return standing(pages, at).filter((page) => page.onGoogle != null && Date.parse(page.onGoogle) <= at).length;
}

/** A stored answer cell names the site: the mention the AI detail's marks count (`answers-store.ts`). */
export function namesSite(cell: unknown, domain: string): boolean {
  const c = cell as { kind?: string; citedDomains?: readonly string[]; named?: boolean } | null;
  return c?.kind === "answered" && (c.named === true || classifyReferences(c.citedDomains ?? [], domain).mentioned);
}

/** The AI tile's one figure: every answered, unbranded AI answer the window's healthy passes read, and those that mentioned or linked the site. */
export interface AiAnswers {
  k: number;
  n: number;
  fromPages: number;
  fromPrompts: number;
}

/** A healthy pass in the AI window ending at `week`: the only weeks that count toward "asked". */
export const inAiWindow = (pass: TilePass, week: string): boolean => pass.healthy && pass.weekStart >= weeksBefore(week, AI_WINDOW_WEEKS - 1) && pass.weekStart <= week;

/** The pages asked over the weeks ending at `week`, those an answer linked, and those only named. */
export function aiWindowOf(passes: readonly TilePass[], pages: readonly TilePage[], week: string, domain = ""): { asked: Set<string>; linked: Set<string>; mentioned: Set<string> } {
  const asked = new Set<string>();
  const linked = new Set<string>();
  const named = new Set<string>();
  for (const pass of passes) {
    if (!inAiWindow(pass, week)) continue;
    for (const [address, page] of liveAt(pages, Date.parse(pass.at))) {
      const by = linkedByIn(pass.report, page.id, page.liveUrl!);
      if (by === null) continue;
      asked.add(address);
      if (by.length > 0) linked.add(address);
      const rows = (pass.report.pageQuestions?.rows ?? []).filter((row) => row.publicationId === page.id);
      if (domain !== "" && rows.some((row) => [row.cell, ...row.engines.map((e) => e.cell)].some((cell) => namesSite(cell, domain)))) named.add(address);
    }
  }
  return { asked, linked, mentioned: new Set([...named].filter((address) => !linked.has(address))) };
}

/** The window ending at `week`'s answers, over the weeks that asked its newest set, and the questions they answered; with `only`, those questions alone.
 *  `answers` is `null` where no healthy pass in it read one. A question that names the site proves nothing, so it is left out. */
function answersIn(passes: readonly TilePass[], week: string, domain: string, only?: ReadonlySet<string>): { answers: AiAnswers | null; asked: Set<string> } {
  const asked = new Set<string>();
  const counts = (question: string): boolean => {
    if (only !== undefined && !only.has(question)) return false;
    asked.add(question);
    return true;
  };
  let k = 0;
  let fromPages = 0;
  let fromPrompts = 0;
  const window = passes.filter((pass) => inAiWindow(pass, week)).sort((x, y) => x.weekStart.localeCompare(y.weekStart));
  for (const pass of newestSet(window, (p) => p.prompts)) {
    const prompts = pass.prompts ?? null;
    const kinds = new Map((prompts?.asked ?? []).map((prompt) => [prompt.id, prompt.kind]));
    for (const answer of prompts?.answers ?? []) {
      const kind = kinds.get(answer.promptId);
      if (kind === undefined || kind === "branded" || !counts(`prompt:${answer.promptId}`)) continue;
      fromPrompts += 1;
      if (namesOrLinks({ namesCustomer: answer.linked, ...(answer.named ? { named: true as const } : {}) })) k += 1;
    }
    for (const row of pass.report.pageQuestions?.rows ?? []) {
      if (textNamesSite(row.question.search, prompts?.siteName ?? null, domain)) continue;
      // A row stored before per-engine cells carries the AI Overview's cell alone; after, `engines` holds it too.
      for (const cell of row.engines.length === 0 ? [row.cell] : row.engines.map((e) => e.cell)) {
        if (cell.kind !== "answered" || !counts(`page:${row.publicationId}:${row.question.search}`)) continue;
        fromPages += 1;
        if (namesOrLinks(cell as unknown as Parameters<typeof namesOrLinks>[0])) k += 1;
      }
    }
  }
  const n = fromPages + fromPrompts;
  return { answers: n === 0 ? null : { k, n, fromPages, fromPrompts }, asked };
}

export const aiAnswersOf = (passes: readonly TilePass[], week: string, domain: string): AiAnswers | null => answersIn(passes, week, domain).answers;

/** Against the window before, on the questions both answered: unread where the latest is not healthy, first where they share none. */
function aiChange(passes: readonly TilePass[], domain: string): TileChange {
  const latest = passes.at(-1)!;
  if (!latest.healthy) return { kind: "unread" };
  const prior = passes.slice(0, -1).filter((pass) => pass.healthy && aiAnswersOf(passes, pass.weekStart, domain) !== null).at(-1);
  const now = answersIn(passes, latest.weekStart, domain).asked;
  const both = new Set(prior === undefined ? [] : [...answersIn(passes, prior.weekStart, domain).asked].filter((question) => now.has(question)));
  if (prior === undefined || both.size === 0) return { kind: "first", at: new Date(latest.at) };
  return diff(answersIn(passes, latest.weekStart, domain, both).answers!.k, answersIn(passes, prior.weekStart, domain, both).answers!.k);
}

/** Against the healthy pass before, only on the searches both read; `moved` counts the searches this pass asked that the one before did not. */
function rivalsChange(passes: readonly TilePass[]): TileChange {
  const latest = passes.at(-1)!;
  const now = latest.firstPage;
  if (!latest.healthy || now === null) return { kind: "unread" };
  const prior = passes.slice(0, -1).filter((pass) => pass.healthy && pass.firstPage !== null).at(-1)?.firstPage;
  const both = prior == null ? [] : [...now].filter(([search, on]) => on !== null && prior.get(search) != null);
  if (prior == null || both.length === 0) return { kind: "first", at: new Date(latest.at) };
  const change = diff(both.filter(([, on]) => on === true).length, both.filter(([search]) => prior.get(search) === true).length);
  const moved = [...now.keys()].filter((search) => !prior.has(search)).length;
  return moved === 0 ? change : { ...change, moved };
}

export function tilesOf(a: {
  passes: readonly TilePass[];
  pages: readonly TilePage[];
  rivals: RivalsFirstPage | null;
  lists: TileLists;
  now: Date;
  /** This site-local week's Monday. */
  week: string;
  /** The site's domain, which an AI answer and a branded question are read against. */
  domain: string;
  /** Pages planned to go live later this week. */
  coming: number;
  /** A page is set to go live. */
  goLive: boolean;
}): TilesModel {
  const passes = [...a.passes].sort((x, y) => x.weekStart.localeCompare(y.weekStart));
  const t = a.now.getTime();
  const live = a.lists.live;
  const latest = passes.at(-1);

  // Pages: every publication ever published, taken-down ones included: the same unit as the figure.
  const ever = new Set(a.pages.map((page) => page.id));
  const weekly = Array.from({ length: TILE_WEEKS }, (_, i) => (i === TILE_WEEKS - 1 ? live : standing(a.pages, t - (TILE_WEEKS - 1 - i) * WEEK_MS).length));
  const lastWeek = weekly.at(-2)!;
  const pages: Tile =
    live === 0
      ? { key: "pages", n: 0, of: { kind: "none" }, change: a.goLive ? { kind: "golive" } : null, series: null }
      : {
          key: "pages",
          n: live,
          of: { kind: "count", m: ever.size },
          change:
            latest === undefined
              ? a.coming > 0 ? { kind: "coming", n: a.coming } : null
              : lastWeek === 0 && a.lists.firstLive !== null ? { kind: "first", at: a.lists.firstLive } : diff(live, lastWeek),
          series: weekly,
        };

  const none = (key: TileKey): Tile => ({ key, n: null, of: { kind: "none" }, change: null, series: null });
  const due = (key: TileKey): Tile => ({ key, n: null, of: { kind: "due" }, change: { kind: "due" }, series: null });

  // On Google: the figure is the Google list's; the weeks before are rebuilt from each page's first date on Google.
  const g = a.lists.google;
  const googleValue = (pass: TilePass): number | null => (pass === latest ? g.on : onGoogleIn(pass, a.pages));
  const google: Tile =
    g.live === 0
      ? none("google")
      : g.unchecked === g.live
        ? due("google")
        : {
            key: "google",
            n: g.on,
            of: { kind: "count", m: g.live, u: g.unchecked },
            shown: g.shown,
            change: latest === undefined ? null : weeklyChange(passes, g.on, googleValue),
            series: seriesOf(passes, a.week, googleValue),
          };

  // AI answers mentioning you: each week is its own window's figure, and a week that asked an older set is a gap.
  const newest = new Set(newestSet(passes.filter((pass) => pass.healthy), (pass) => pass.prompts));
  const current = passes.filter((pass) => !pass.healthy || newest.has(pass));
  const aiValue = (pass: TilePass): number | null => aiAnswersOf(current, pass.weekStart, a.domain)?.k ?? null;
  const answers = latest === undefined ? null : aiAnswersOf(current, latest.weekStart, a.domain);
  const ai: Tile =
    live === 0
      ? none("ai")
      : answers === null
        ? due("ai")
        : {
            key: "ai",
            n: answers.k,
            of: { kind: "count", m: answers.n },
            change: aiChange(current, a.domain),
            series: seriesOf(current, a.week, aiValue),
          };

  // Against Competitors: the Competitors screen's own count; the change is on the searches both passes read.
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
              : rivalsChange(passes),
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
