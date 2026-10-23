// SPEC §4 (owner, 2026-10-19, the simple model; board Main) — the weekly and
// monthly figures, each counted over the rows it names, so a figure and the
// list it opens are one selector. Pure: stored readings in, figures out, and
// a figure nothing measured is `null`, never 0.
import { FIRST_PAGE_PLACES, type PageReading } from "@/lib/measure/page-reading";
import { climbing } from "@/lib/opportunities/verdicts/verdict";
import type { PublishedPage } from "./content";

/** The live pages whose own question was asked, and those an answer linked. */
export interface AiPages {
  asked: readonly PublishedPage[];
  linked: readonly PublishedPage[];
}

/** `null` where no live page's question has been asked yet. */
export function aiPagesOf(pages: readonly PublishedPage[]): AiPages | null {
  const asked = pages.filter((page) => page.reading?.linkedBy != null);
  if (asked.length === 0) return null;
  return { asked, linked: asked.filter((page) => (page.reading?.linkedBy ?? []).length > 0) };
}

export interface BestMover {
  page: PublishedPage;
  search: string;
  place: number;
  /** Where the page was first seen, which the gain is counted from. */
  first: { at: string; place: number };
  gain: number;
  /** Still gaining inside the verdict's window, so it is left alone. */
  climbing: boolean;
  readAt: string;
}

/**
 * The page that moved up most since the reading before this one, of those
 * standing above where they were first seen. `null` where a place was read
 * and nothing moved up; `undefined` where no page holds a place at all.
 */
export function bestMoverOf(pages: readonly PublishedPage[], now: Date): BestMover | null | undefined {
  const placed = pages.filter((page): page is PublishedPage & { reading: PageReading } => page.reading?.place != null);
  if (placed.length === 0) return undefined;
  let best: { page: (typeof placed)[number]; moved: number } | null = null;
  for (const page of placed) {
    const { place, prev, first } = page.reading;
    if (place === null || prev === null || first === null || prev <= place.value || first.place <= place.value) continue;
    const moved = prev - place.value;
    if (best === null || moved > best.moved || (moved === best.moved && place.value < best.page.reading.place!.value)) {
      best = { page, moved };
    }
  }
  if (best === null) return null;
  const reading = best.page.reading;
  return {
    page: best.page,
    search: reading.place!.query,
    place: reading.place!.value,
    first: reading.first!,
    gain: reading.first!.place - reading.place!.value,
    climbing: climbing(reading, now),
    readAt: reading.at,
  };
}

/** Google's first page, for the mover chart's band. */
export const FIRST_PAGE = FIRST_PAGE_PLACES;

// ── The months-scale figures ──────────────────────────────────────────────

/** The reading the month's figures are taken from: the weekly pass of the
 *  month's first Monday. */
export interface MonthReading {
  week: string;
  /** The Visibility Score, `null` where that pass scored none. */
  score: number | null;
  /** Your market's searches on Google's first page, of those measured. */
  market: { top10: number; of: number } | null;
}

export interface MonthsFacts {
  /** `null` before the first month's reading. */
  reading: MonthReading | null;
  /** The same two figures at the customer's own scan, where it scored them. */
  scan: { score: number | null; market: number | null };
  /** The first Monday the next reading is taken on. */
  next: string;
}

function dayOf(week: string): number {
  return Number(week.slice(8, 10));
}

/** A week whose Monday is one of its month's first seven days. */
export function isFirstMonday(week: string): boolean {
  return dayOf(week) <= 7;
}

/** The first Monday of the month after the one `week` starts in. */
export function nextFirstMonday(week: string): string {
  const [year, month] = week.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, month, 1, 12));
  first.setUTCDate(1 + ((8 - first.getUTCDay()) % 7));
  return first.toISOString().slice(0, 10);
}

/** The newest first-Monday week among the measured ones, oldest first. */
export function monthWeekOf(measured: readonly string[]): string | null {
  return [...measured].reverse().find(isFirstMonday) ?? null;
}
