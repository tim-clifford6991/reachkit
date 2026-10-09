// SPEC §6 (2026-09-20, #908) measure (d) — *AI engines on your blog*, in
// one shape.
//
// "On hosted blogs only: pages fetched by an answer engine for a user's
// question, and visitors arriving from one, counted by day, page and
// engine, shown as 'at least'. Training crawlers are not progress and are
// not shown."
//
// **This file is pure.** Stored cells in, model out — the same split
// the app's `answers-model.ts` makes, so every rule below is settled by a
// test with no database and no browser. Reading the cells is
// `facts.ts`'s (a real account) and the app's `blog-reads-fixture.ts`'s
// (the reserved fixture account).
//
// **Two measures, and they are never added together.** A fetch is an engine
// reading the page; a referral is a person arriving. Summing them would
// invent an audience out of robots.
//
// **The third stored kind is not drawn.** `index_fetch` — a search indexer
// building the index its answers come from — is counted (issue #921 asks
// for it by name) and has no figure on this card, because §6(d) names two
// measures and a third would be a reading the owner did not ask for.
//
// **Nothing here is a rank or a sentiment.** §11 (2026-09-20): "an 'AI rank
// position' or sentiment measure" is not in the MVP. There is no member
// below one could be rendered from, which is the only way that stays true.
import { AI_BLOG_ENGINES } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { BlogEngine } from "@/lib/publish/reads/classify";
import type { BlogReadRow } from "@/lib/publish/reads/store";

/** What the store hands this file. `rows: null` is "the counts could not be
 *  read" and `rows: []` is "nothing was counted in the window" — two
 *  different sentences on the screen, never one. */
export interface BlogReadsFacts {
  /** `null` where the site publishes nowhere ReachKit hosts: the card is
   *  not drawn at all, because it would be a measure of somebody else's
   *  server. */
  hosted: boolean;
  rows: readonly BlogReadRow[] | null;
  /** How many live hosted pages the site has. A site with none has no blog
   *  to count reads of yet, and the card says so rather than showing two
   *  zeroes. */
  livePages: number;
}

/** One engine's row under the fetch figure. Always every engine the build
 *  knows, in the pin's order, so a reader sees which engines are silent —
 *  a missing row and a zero row are the same fact here and the zero is the
 *  honest one. */
export interface BlogEngineCount {
  engine: BlogEngine;
  fetches: number;
}

export interface BlogReadsModel {
  /** Pages fetched by an answer engine to answer someone's question. */
  fetches: Measured<number>;
  /** Visitors who arrived from an AI answer. Always "at least": most AI
   *  apps send neither a referrer nor a tagged link, so this is a floor and
   *  the sentence beside it says so. */
  referrals: Measured<number>;
  byEngine: readonly BlogEngineCount[];
  /** The fetches counted in the window before this one, for the change
   *  (SPEC §4, 2026-10-09, issue 1364). `null` where nothing at all is
   *  stored for that window: a blog nobody counted then has no earlier
   *  figure to be compared against, and a change against nothing would be
   *  an invented one. */
  previousFetches: number | null;
  /** The window the figures are read over, in days. */
  windowDays: number;
  /** Whether the card is drawn at all. */
  show: boolean;
}

/**
 * The first day of the card's window, as the stored `date`.
 *
 * Inclusive, and counted back from today: a seven-day window is today and
 * the six days before it, never eight. Pure, and here rather than beside
 * the read, so the arithmetic is settled without a database.
 */
export function windowStartDay(at: Date, windowDays: number): string {
  const start = new Date(at.getTime());
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));
  return start.toISOString().slice(0, 10);
}

/** Every engine, in the pin's order, with zero where nothing was counted. */
function engineCounts(rows: readonly BlogReadRow[]): readonly BlogEngineCount[] {
  const totals = new Map<BlogEngine, number>(AI_BLOG_ENGINES.map((engine) => [engine, 0]));
  for (const row of rows) {
    if (row.kind !== "answer_fetch") continue;
    totals.set(row.engine, (totals.get(row.engine) ?? 0) + row.hits);
  }
  return AI_BLOG_ENGINES.map((engine) => ({ engine, fetches: totals.get(engine) ?? 0 }));
}

function totalOf(rows: readonly BlogReadRow[], kind: BlogReadRow["kind"]): number {
  let sum = 0;
  for (const row of rows) if (row.kind === kind) sum += row.hits;
  return sum;
}

/**
 * The card's model.
 *
 * `at` is the caller's clock, never read here — the same rule every other
 * model on this screen follows.
 */
export function assembleBlogReads(
  facts: BlogReadsFacts,
  windowDays: number,
  at: Date
): BlogReadsModel {
  // **Two reasons not to draw it at all**, and neither of them is a zero.
  // §6(d) is "on hosted blogs only", so a WordPress customer's visitors —
  // who reach a server this product does not own — get no card; and a
  // hosted blog with nothing published yet has nothing an engine could have
  // fetched, so two zeroes would be a claim about engines rather than a
  // fact about the record.
  const show = facts.hosted && facts.livePages > 0;

  const rows = facts.rows;
  if (!show || rows === null) {
    // `rows === null` is "read and failed", which REQ-004 keeps apart from
    // zero: a card of zeroes would say the engines ignored the blog, and
    // nobody measured that.
    return {
      fetches: unmeasured("undeterminable", at),
      referrals: unmeasured("undeterminable", at),
      byEngine: engineCounts([]),
      previousFetches: null,
      windowDays,
      show,
    };
  }

  // The store hands back this window and the one before it (`facts.ts`):
  // the figures are this window's, and the earlier rows are only what the
  // change is read against.
  const start = windowStartDay(at, windowDays);
  const earliest = windowStartDay(at, windowDays * 2);
  const current = rows.filter((row) => row.day >= start);
  const earlier = rows.filter((row) => row.day < start && row.day >= earliest);

  const fetches = totalOf(current, "answer_fetch");
  const referrals = totalOf(current, "referral");
  // A hosted blog with pages live that nothing has read is a real zero —
  // the reading was taken and it came back empty.
  const asMeasured = (total: number): Measured<number> =>
    total === 0 ? measuredZero(0, at) : measured(total, at);

  return {
    fetches: asMeasured(fetches),
    referrals: asMeasured(referrals),
    byEngine: engineCounts(current),
    previousFetches: earlier.length === 0 ? null : totalOf(earlier, "answer_fetch"),
    windowDays,
    show,
  };
}
