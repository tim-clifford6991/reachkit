// SPEC §4 (plate O4) — each live page in Google: its own search, where it sits this
// week, how it got there, its label and the best competitor there, read from stored rows.
// Pure. A page no reading reached is not measured, never a place of 0.
import { registrableDomain, isOwnDomain } from "@/lib/market/rivals/domains";
import { googleStateOf, type GoogleState } from "@/lib/measure/ladder";
import { addressOf, googleRead, searchRowsFor, type PageReading, type PlaceReport } from "@/lib/measure/page-reading";
import { verdict } from "@/lib/opportunities/verdicts/verdict";
import type { Label } from "@/lib/opportunities/verdicts/types";
import { standingAt, type PublishedPage } from "@/lib/measure/published";
import { dayNumber, weekdayShort } from "../calendar/dates";
import type { WeekModel } from "../calendar/month";
import { searchKey, type Planned } from "./search-model";
import type { TilePage, TilePass } from "./tiles";

const MS_PER_WEEK = 7 * 86_400_000;

/** The one line under a page's search, as facts; the screen speaks them. */
export type PlaceLine =
  | { kind: "up"; place: number; search: string; gain: number; since: string }
  | { kind: "flat"; place: number; search: string; weeks: number }
  | { kind: "now"; place: number; search: string }
  | { kind: "found"; at: string }
  | { kind: "unseen" }
  | { kind: "unread" };

export interface GooglePageRow {
  id: string;
  title: string;
  titleLabel?: string;
  href: string | null;
  /** The search its place is read on; `null` where no place was read. */
  search: string | null;
  line: PlaceLine;
  label: Label | null;
  place: number | null;
  reading: PageReading | null;
  /** Added, shown, on Google and checked: the one rule every count here is taken from. */
  state: GoogleState;
}

/** The line under the tile's of-line: how often Google showed the live pages, or why that is not read yet. */
export type GoogleShown =
  | { kind: "shown"; n: number }
  | { kind: "waiting"; visited: number; start: string | null }
  | { kind: "no-console" };

export interface GooglePages {
  rows: readonly GooglePageRow[];
  /** Every row: the tile's and the pills' total. */
  live: number;
  /** The rows on Google: the tile's figure. */
  on: number;
  /** The rows nothing has read yet. */
  unchecked: number;
  shown: GoogleShown;
}

/** The site's Search Console property: `null` where it has none (WordPress, or never verified). */
export interface GoogleConsole {
  sitemapAt: string | null;
}

/** The first Monday check on or after the property is old enough to be asked for impressions; `null` before the sitemap went in. */
export function countsStartOf(gsc: GoogleConsole, newDays: number): string | null {
  if (gsc.sitemapAt === null) return null;
  const day = new Date(Date.parse(gsc.sitemapAt) + newDays * 86_400_000);
  day.setUTCDate(day.getUTCDate() + ((8 - day.getUTCDay()) % 7));
  return day.toISOString().slice(0, 10);
}

/** The pages live at the latest healthy pass that it read their own search's result page for. */
export function serpReadOf(passes: readonly TilePass[], pages: readonly TilePage[]): ReadonlySet<string> {
  const healthy = [...passes].filter((pass) => pass.healthy).sort((x, y) => x.weekStart.localeCompare(y.weekStart)).at(-1);
  if (healthy === undefined) return new Set();
  // A result read before the page went live says nothing of the page.
  const at = new Date(healthy.at);
  return new Set(pages.flatMap((page) => (standingAt(page, at) && page.search !== null && searchRowsFor(healthy.report, page.search, { tracked: false }).kind !== "unmeasured" ? [page.id] : [])));
}

const LABEL_ORDER: Readonly<Record<Label, number>> = { working: 0, climbing: 1, not_moving: 2, too_early: 3 };

function lineOf(page: PublishedPage, now: Date): PlaceLine {
  const reading = page.reading;
  if (reading == null) return { kind: "unread" };
  const { place, first, best } = reading;
  if (place === null) return reading.reached.found === undefined ? { kind: "unseen" } : { kind: "found", at: reading.reached.found };
  if (first !== null && first.place > place.value) {
    return { kind: "up", place: place.value, search: place.query, gain: first.place - place.value, since: first.at };
  }
  const weeks = best === null ? 0 : Math.round((now.getTime() - Date.parse(best.at)) / MS_PER_WEEK);
  return weeks >= 2 ? { kind: "flat", place: place.value, search: place.query, weeks } : { kind: "now", place: place.value, search: place.query };
}

export function googlePagesOf(all: readonly PublishedPage[], now: Date, serpRead: ReadonlySet<string>, gsc: GoogleConsole | null, start: string | null): GooglePages {
  const pages = all.filter((page) => page.publishedAt <= now);
  const rows = pages.map((page): GooglePageRow => {
    const reading = page.reading ?? null;
    return {
      id: page.id,
      title: page.title,
      ...(page.titleLabel === undefined ? {} : { titleLabel: page.titleLabel }),
      href: page.draftId === undefined ? null : `/app/draft/${page.draftId}`,
      search: reading?.place?.query ?? null,
      line: lineOf(page, now),
      label: reading === null ? null : verdict(reading, now),
      place: reading?.place?.value ?? null,
      reading,
      state: googleStateOf(reading, serpRead.has(page.id)),
    };
  });
  const rank = (row: GooglePageRow): number => (row.label === null ? 4 : LABEL_ORDER[row.label]);
  rows.sort((a, b) => rank(a) - rank(b) || (a.place ?? Infinity) - (b.place ?? Infinity) || a.title.localeCompare(b.title));
  const read = pages.flatMap((page) => googleRead(page.reading?.google) ?? []);
  const visited = pages.filter((page) => page.reading?.googlebot === true || page.reading?.google?.lastCrawl != null).length;
  const shown: GoogleShown =
    read.length > 0
      ? { kind: "shown", n: read.reduce((sum, google) => sum + google.impressions, 0) }
      : gsc === null
        ? { kind: "no-console" }
        : { kind: "waiting", visited, start };
  return { rows, live: rows.length, on: rows.filter((row) => row.state.on).length, unchecked: rows.filter((row) => !row.state.checked).length, shown };
}

/** One row of On Google's detail: the page, its own search, that search's demand and who leads it. */
export interface GoogleSearchRow {
  page: GooglePageRow;
  search: string | null;
  /** `null` where never measured, which is not 0. */
  volume: number | null;
  /** The best other site on that search where the week read it; `null` where it read none. */
  rival: { name: string; place: number } | null;
  publishedAt: string;
}

export interface GoogleSearch {
  /** The pages the tile counts, top place first. */
  on: readonly GoogleSearchRow[];
  /** The rest of the tile's live pages, newest live first. */
  notYet: readonly GoogleSearchRow[];
  /** The healthy pass the competitors were read on. */
  readAt: string | null;
}

/** The best result on `search` that is neither this site nor this page. */
function rivalOn(report: PlaceReport, search: string, domain: string, own: string | null): GoogleSearchRow["rival"] {
  const rows = searchRowsFor(report, search, { tracked: false });
  if (rows.kind === "unmeasured" || rows.value.serp === null) return null;
  for (const hit of [...rows.value.serp].sort((a, b) => a.position - b.position)) {
    const name = registrableDomain(hit.url);
    if (name !== null && !isOwnDomain(name, domain) && addressOf(hit.url) !== own) return { name, place: hit.position };
  }
  return null;
}

/** On Google's detail rows: the tile's own pages, split as the tile counts them, so the pills and the tile state one number. */
export function googleSearchOf(google: GooglePages, pages: readonly TilePage[], passes: readonly TilePass[], domain: string): GoogleSearch {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const healthy = [...passes].filter((pass) => pass.healthy).sort((x, y) => x.weekStart.localeCompare(y.weekStart)).at(-1);
  const rows = google.rows.map((page): GoogleSearchRow => {
    const stored = byId.get(page.id);
    const search = stored?.search ?? page.search;
    const own = stored?.liveUrl == null ? null : addressOf(stored.liveUrl);
    return {
      page,
      search,
      volume: stored?.volume ?? null,
      rival: search === null || healthy === undefined ? null : rivalOn(healthy.report, search, domain, own),
      publishedAt: stored?.publishedAt ?? "",
    };
  });
  const placed = (row: GoogleSearchRow): boolean => row.page.state.on;
  return {
    on: rows.filter(placed).sort((a, b) => (a.page.place ?? Infinity) - (b.page.place ?? Infinity)),
    notYet: rows.filter((row) => !placed(row)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    readAt: healthy?.at ?? null,
  };
}

/** Plan's pages still to go live this week, by the search each targets. */
export function plannedOf(week: Pick<WeekModel, "cells" | "today">): ReadonlyMap<string, Planned> {
  const out = new Map<string, Planned>();
  for (const cell of week.cells) {
    const page = cell.page;
    if (page === null || page.stage === "live" || cell.day < week.today) continue;
    const key = searchKey(page.why.search);
    if (!out.has(key)) out.set(key, { day: `${weekdayShort(cell.day)} ${dayNumber(cell.day)}`, today: cell.day === week.today, update: page.update });
  }
  return out;
}

/** Plan's week, by search, as Overview reaches it: at the call, so this graph
 *  holds no vendor client. Empty where it cannot be read. */
export async function readPlanned(): Promise<ReadonlyMap<string, Planned>> {
  try {
    const { planToday, readWeek } = await import("../calendar/provider");
    return plannedOf(await readWeek(await planToday()));
  } catch {
    return new Map();
  }
}
