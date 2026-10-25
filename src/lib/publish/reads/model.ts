// SPEC §6 measure (d) — *AI engines on your blog*: "On hosted blogs only: pages fetched by an answer engine for a user's
// question, and visitors arriving from one, counted by day, page and engine, shown as 'at least'. Training crawlers are
// not progress and are not shown."
// Pure: stored cells in, model out; `facts.ts` and the app's fixture read the cells.
// Fetches and referrals are never added together, which would invent an audience out of robots. `index_fetch` is
// counted but not drawn, as §6(d) names two measures. Nothing here is a rank or a sentiment (§11), and no member could render one.
import { AI_BLOG_ENGINES, BLOG_READS_RETENTION_W } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { BlogEngine } from "@/lib/publish/reads/classify";
import type { BlogReadRow } from "@/lib/publish/reads/store";

/** `rows: null` is "could not be read" and `rows: []` "nothing counted": two sentences, never one. */
export interface BlogReadsFacts {
  /** `false` where the site publishes nowhere we host: no card, as it would measure somebody else's server. */
  hosted: boolean;
  rows: readonly BlogReadRow[] | null;
  /** Live hosted pages; with none, the card says so rather than showing two zeroes. */
  livePages: number;
}

/** One engine's row: every engine, in the pin's order, so a silent one shows its honest zero. */
export interface BlogEngineCount {
  engine: BlogEngine;
  fetches: number;
  referrals: number;
}

export interface BlogReadsModel {
  /** Pages fetched by an answer engine to answer someone's question. */
  fetches: Measured<number>;
  /** Visitors from an AI answer, always "at least": most AI apps send no referrer or tag, so this is a floor. */
  referrals: Measured<number>;
  byEngine: readonly BlogEngineCount[];
  /** The window the figures are read over, in days. */
  windowDays: number;
  /** Answer fetches and visits per seven days, oldest first, each from its first day,
   *  over the weeks the counts are kept; the weeks before the first fetch are
   *  left out, never zeroes. */
  weekly: readonly { start: string; fetches: number; referrals: number }[];
  /** Whether the card is drawn at all. */
  show: boolean;
}

/** One week of visits from Google search, keyed by its first day. */
export interface VisitWeek {
  start: string;
  visits: number;
}

/** The window's first day as the stored `date`, inclusive: seven days is today and the six before, never eight. */
export function windowStartDay(at: Date, windowDays: number): string {
  const start = new Date(at.getTime());
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));
  return start.toISOString().slice(0, 10);
}

/** Every engine, in the pin's order, with zero where nothing was counted. */
function engineCounts(rows: readonly BlogReadRow[]): readonly BlogEngineCount[] {
  return AI_BLOG_ENGINES.map((engine) => {
    const own = rows.filter((row) => row.engine === engine);
    return { engine, fetches: totalOf(own, "answer_fetch"), referrals: totalOf(own, "referral") };
  });
}

function totalOf(rows: readonly BlogReadRow[], kind: BlogReadRow["kind"]): number {
  let sum = 0;
  for (const row of rows) if (row.kind === kind) sum += row.hits;
  return sum;
}

/** The card's model; `at` is the caller's clock, never read here. */
export function assembleBlogReads(
  facts: BlogReadsFacts,
  windowDays: number,
  at: Date
): BlogReadsModel {
  // Not drawn for a non-hosted site (§6(d)) or one with nothing live; neither is a zero.
  const show = facts.hosted && facts.livePages > 0;

  const rows = facts.rows;
  if (!show || rows === null) {
    // A failed read is not zero (REQ-004): zeroes would say the engines ignored the blog, which nobody measured.
    return {
      fetches: unmeasured("undeterminable", at),
      referrals: unmeasured("undeterminable", at),
      byEngine: engineCounts([]),
      windowDays,
      weekly: [],
      show,
    };
  }

  // The figures are this window's; older rows feed only the weekly series.
  const start = windowStartDay(at, windowDays);
  const current = rows.filter((row) => row.day >= start);

  const fetches = totalOf(current, "answer_fetch");
  const referrals = totalOf(current, "referral");
  // Pages live and nothing read is a real zero: the reading was taken and came back empty.
  const asMeasured = (total: number): Measured<number> =>
    total === 0 ? measuredZero(0, at) : measured(total, at);

  return {
    fetches: asMeasured(fetches),
    referrals: asMeasured(referrals),
    byEngine: engineCounts(current),
    windowDays,
    weekly: weeklyFetches(rows, at),
    show,
  };
}

/** Answer fetches and visits per seven days ending today, over the weeks kept. */
function weeklyFetches(rows: readonly BlogReadRow[], at: Date): { start: string; fetches: number; referrals: number }[] {
  const weeks: { start: string; fetches: number; referrals: number }[] = [];
  for (let back = BLOG_READS_RETENTION_W - 1; back >= 0; back -= 1) {
    const end = windowStartDay(at, back * 7);
    const start = windowStartDay(at, (back + 1) * 7);
    const week = rows.filter((row) => row.day >= start && (back === 0 || row.day < end));
    weeks.push({ start, fetches: totalOf(week, "answer_fetch"), referrals: totalOf(week, "referral") });
  }
  const firstRead = weeks.findIndex((week) => week.fetches > 0);
  return firstRead === -1 ? [] : weeks.slice(firstRead);
}
