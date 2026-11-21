// SPEC §4 (owner, 2026-10-19, the simple model; board Main) — the weekly and
// monthly figures, each counted over the rows it names, so a figure and the
// list it opens are one selector. Pure: stored readings in, figures out, and
// a figure nothing measured is `null`, never 0.
import { shownScore } from "@/lib/scan/shown-score";
import type { Measured } from "./measured";

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
  scan: { score: number | null; market: { top10: number; of: number } | null };
  /** The first Monday the next reading is taken on. */
  next: string;
}

/** A week whose Monday is one of its month's first seven days. */
function isFirstMonday(week: string): boolean {
  return Number(week.slice(8, 10)) <= 7;
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

/** What the month's figures read off a stored report, declared by shape so
 *  Overview's graph does not reach the scan's modules. */
export interface MonthReport {
  verdict?: { scoreAndBand?: Measured<{ score: number }> | null } | null;
  presence?: { measuredSearches: number; you: { top10Count: number } } | null;
  /** One slot per search the pass selected, measured or not. */
  serps?: readonly unknown[];
}

/** The two months-scale figures one stored report holds: its score, and the
 *  presence card's count of the twelve on Google's first page. A pass that
 *  measured fewer searches than it selected stopped early, so it gives no
 *  market figure. */
export function monthFiguresOf(report: MonthReport | null): Omit<MonthReading, "week"> {
  const presence = report?.presence;
  const selected = report?.serps?.length;
  return {
    score: shownScore(report),
    market:
      presence == null || selected === undefined || presence.measuredSearches < selected
        ? null
        : { top10: presence.you.top10Count, of: presence.measuredSearches },
  };
}
