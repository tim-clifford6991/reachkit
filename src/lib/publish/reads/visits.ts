// SPEC §4 *Overview's four tiles* · SPEC §7 *Hosted reads are counts* — the one read of a site's visits over 28 days, by
// source, with the clicks through beneath; Overview's Visits tile and the Monday mail both read it. Stored rows only.
// The headline is Google, AI apps and other sites; "opened directly" is returned apart and never added to it.
import { AI_BLOG_ENGINES, ONWARD_CLICKS_COUNTED } from "@/lib/config/constants";
import { publishDb } from "../db";
import { windowStartDay } from "./model";

/** The window the figure is read over: its own constant, never the retention's, which also sets three other windows. */
export const VISITS_WINDOW_D = 28;
/** Every source was counted from this day (§7), so no figure reaches back past it, for any customer. */
export const VISITS_COUNTED_FROM = "2026-11-22";
/** The closed weeks the tile's line draws. */
const VISIT_WEEKS = 6;
const WEEK_MS = 7 * 86_400_000;

const AI = new Set<string>(AI_BLOG_ENGINES);

export interface Visits {
  /** Google, AI apps and other sites over the window. */
  n: number;
  bySource: { google: number; ai: number; other: number };
  /** Opened directly: never in `n`. */
  direct: number;
  /** Clicks through to the business, each page capped at its own views, direct included; `null` while clicks are off. */
  clicks: number | null;
  /** The pages an AI app fetched to answer someone in the window. */
  aiRead: readonly string[];
  /** The first day counted, where the window is shorter than 28 days; `null` once it is whole. */
  since: string | null;
  /** The visits of each of the last six closed weeks, oldest first; a week with no row is `null`, never 0. */
  weeks: readonly (number | null)[];
}

interface ReadRow {
  publication_id: string;
  engine: string;
  kind: string;
  hits: number;
}

const isVisit = (engine: string): boolean => engine === "google" || engine === "other" || AI.has(engine);

/** The window's counts from the daily rows and the weekly rows; `start` is the first day this site could be counted. */
export function visitsOf(a: { reads: readonly ReadRow[]; weeks: readonly { week_start: string; counts: Record<string, number> }[]; now: Date; start: string }): Visits {
  const bySource = { google: 0, ai: 0, other: 0 };
  let direct = 0;
  const views = new Map<string, number>();
  const clicks = new Map<string, number>();
  const aiRead = new Set<string>();
  for (const row of a.reads) {
    if (row.kind === "answer_fetch") aiRead.add(row.publication_id);
    if (row.kind === "outbound") clicks.set(row.publication_id, (clicks.get(row.publication_id) ?? 0) + row.hits);
    if (row.kind !== "referral") continue;
    views.set(row.publication_id, (views.get(row.publication_id) ?? 0) + row.hits);
    if (row.engine === "none") direct += row.hits;
    else if (row.engine === "google" || row.engine === "other") bySource[row.engine] += row.hits;
    else if (AI.has(row.engine)) bySource.ai += row.hits;
  }
  const capped = [...clicks].reduce((sum, [page, n]) => sum + Math.min(n, views.get(page) ?? 0), 0);
  const monday = Date.parse(windowStartDay(a.now, ((a.now.getUTCDay() + 6) % 7) + 1));
  const weeks = Array.from({ length: VISIT_WEEKS }, (_, i) => {
    const start = new Date(monday - (VISIT_WEEKS - i) * WEEK_MS).toISOString().slice(0, 10);
    const rows = a.weeks.filter((row) => row.week_start === start);
    // A week counted before every source was is a different measure: a gap, as a week no pass saw is.
    if (rows.length === 0 || start < VISITS_COUNTED_FROM) return null;
    return rows.reduce((sum, row) => sum + Object.entries(row.counts).reduce((s, [key, n]) => (key.startsWith("referral:") && isVisit(key.slice(9)) ? s + n : s), 0), 0);
  });
  return {
    n: bySource.google + bySource.ai + bySource.other,
    bySource,
    direct,
    clicks: ONWARD_CLICKS_COUNTED ? capped : null,
    aiRead: [...aiRead],
    since: a.start > windowStartDay(a.now, VISITS_WINDOW_D) ? a.start : null,
    weeks,
  };
}

/** The site's visits; `firstLive` is its first page's go-live. `null` where the rows could not be read, never zeros. */
export async function readVisits(a: { siteId: string; now: Date; firstLive: Date | null }): Promise<Visits | null> {
  const db = publishDb();
  const from = windowStartDay(a.now, VISITS_WINDOW_D);
  const [reads, weeks] = await Promise.all([
    db.from<ReadRow>("publication_reads").select("publication_id, engine, kind, hits").eq("site_id", a.siteId).gte("day", from),
    db
      .from<{ week_start: string; counts: Record<string, number> }>("publication_weeks")
      .select("week_start, counts")
      .eq("site_id", a.siteId)
      .gte("week_start", windowStartDay(a.now, (VISIT_WEEKS + 1) * 7)),
  ]);
  if (reads.error !== null || weeks.error !== null) return null;
  const live = a.firstLive === null ? VISITS_COUNTED_FROM : a.firstLive.toISOString().slice(0, 10);
  return visitsOf({ reads: reads.data ?? [], weeks: weeks.data ?? [], now: a.now, start: live > VISITS_COUNTED_FROM ? live : VISITS_COUNTED_FROM });
}
