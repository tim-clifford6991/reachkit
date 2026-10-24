// SPEC §4 (board AppGoogle) — each live page in Google: where it sits this
// week, how it got there, and its label, read from its stored weekly reading.
// Pure. A page no reading reached is not measured, never a place of 0.
import { verdict } from "@/lib/opportunities/verdicts/verdict";
import type { Label } from "@/lib/opportunities/verdicts/types";
import type { PublishedPage } from "@/lib/measure/published";
import { dayNumber, weekdayShort } from "../calendar/dates";
import type { WeekModel } from "../calendar/month";
import { searchKey, type Planned } from "./search-model";

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
  href: string | null;
  /** The search its place is read on; `null` where no place was read. */
  search: string | null;
  line: PlaceLine;
  label: Label | null;
  /** The place came from Google's estimate rather than a live result (D8). */
  estimate: boolean;
  place: number | null;
  /** The place the reading before this one held. */
  before: number | null;
}

export interface GooglePages {
  rows: readonly GooglePageRow[];
  live: number;
  /** Pages a weekly reading reached; the figures below count only these. */
  read: number;
  showing: number;
  firstPage: number;
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

export function googlePagesOf(all: readonly PublishedPage[], now: Date): GooglePages {
  const pages = all.filter((page) => page.publishedAt <= now);
  const read = pages.filter((page) => page.reading != null);
  const rows = pages.map((page): GooglePageRow => {
    const reading = page.reading ?? null;
    return {
      id: page.id,
      title: page.title,
      href: page.draftId === undefined ? null : `/app/draft/${page.draftId}`,
      search: reading?.place?.query ?? null,
      line: lineOf(page, now),
      label: reading === null ? null : verdict(reading, now),
      estimate: reading?.place?.source === "labs",
      place: reading?.place?.value ?? null,
      before: reading?.prev ?? null,
    };
  });
  const rank = (row: GooglePageRow): number => (row.label === null ? 4 : LABEL_ORDER[row.label]);
  rows.sort((a, b) => rank(a) - rank(b) || (a.place ?? Infinity) - (b.place ?? Infinity) || a.title.localeCompare(b.title));
  return {
    rows,
    live: pages.length,
    read: read.length,
    showing: read.filter((page) => page.reading!.reached.showing !== undefined).length,
    firstPage: read.filter((page) => page.reading!.reached.firstPage !== undefined).length,
  };
}

/** The searches whose live page is still climbing, so it is left alone. */
export function climbingSearches(pages: GooglePages): ReadonlySet<string> {
  return new Set(pages.rows.flatMap((row) => (row.label === "climbing" && row.search !== null ? [searchKey(row.search)] : [])));
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
