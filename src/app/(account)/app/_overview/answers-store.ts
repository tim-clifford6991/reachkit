// SPEC §4 · §6 (2026-09-20, #908) — the AI answers tab's facts, for a real
// account.
//
// The other half of `answers-provider.ts`. It measures nothing, buys
// nothing and creates nothing: "all from data already stored" is §4's own
// rule for this tab, and every value below is a projection of rows the
// weekly pass already wrote.
//
// **What is read, and whose rows it is:**
//
//   the passes    §11's stored weekly scans — `readWeekScans` over the
//                 last `ANSWER_RATE_WEEKS` Mondays, one read, not four
//   the answers   each pass's own `AiAnswersSection` (`src/lib/scan/
//                 report.ts`) — the twelve questions and, per question,
//                 §6.2's three engine columns
//   your page     §9's live `publications`, joined to the opportunity each
//                 draft was written for, so a question's own search finds
//                 the page ReachKit published for it
//
// **Two reads, and neither of them per row.** A read per week would be four
// round trips on a render path, and a read per question would be twelve.
//
// **The one rule this file decides is `markOf`**, and it decides it with
// the score's own function. `classifyReferences` (`@/lib/measure/
// drivers.ts`) is what `aiPresenceOf` splits its mention rate from its
// citation rate with; this screen draws that same split as two marks. A
// second implementation here would be a second answer to "what does it mean
// that an AI answer named you".
//
// **A pass that stored no AI-answers section is absent, not empty.** A week
// with no row and a week in which nobody was named are two different facts,
// and an empty week would lower the four-week rate as though twelve
// questions had been asked and every one of them ignored the site.
import { dbAdmin } from "@/lib/db";
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import { classifyReferences } from "@/lib/measure/drivers";
import type { AnswerCell, StoredReport } from "@/lib/scan/report";
import { previousWeekStart, readWeekScans, weekStartFor } from "@/lib/scan/weekly";
import type { AnswerEngine } from "@/lib/opportunities/types";
import {
  ANSWER_ENGINES,
  type AnswerMark,
  type AnswerPage,
  type AnswerQuestion,
  type AnswersFacts,
  type AnswerWeekFacts,
} from "./answers-model";

export interface AnswersSite {
  siteId: string;
  timeZone: string;
  /** The site's own domain — what "linked to you" and "named you" are
   *  decided against. */
  domain: string;
}

/**
 * One engine's cell, as one of the five marks.
 *
 * The two arms that are not readings pass straight through: a cell nobody
 * reached is `not_measured` and leaves every denominator, and an engine
 * that served no answer is `no_answer` and is not a place the site was
 * ignored (§6.2's own rule).
 *
 * An answered cell is split by `classifyReferences` — the score's function,
 * not a second one. *Linked* is a reference whose host is the site's own;
 * *named* is a reference somewhere else carrying the site's brand token
 * whole. The two are disjoint there and stay disjoint here, with `linked`
 * winning where an answer did both: a link is the stronger fact and the
 * tile beneath already counts the two apart.
 */
export function markOf(cell: AnswerCell, ownDomain: string): AnswerMark {
  if (cell.kind === "unmeasured") return "not_measured";
  if (cell.kind === "no_answer") return "no_answer";
  const { cited, mentioned } = classifyReferences(cell.citedDomains, ownDomain);
  if (cited) return "links_to_you";
  if (mentioned) return "names_you";
  return "names_others";
}

export async function readAnswerFacts(site: AnswersSite, at: Date): Promise<AnswersFacts> {
  // One list of Mondays, computed once: three readings of the same window
  // is three chances for the rate, the grid and the date to mean three
  // different sets of weeks.
  const weekStarts = windowWeeks(at, site.timeZone);
  const [scans, pages] = await Promise.all([
    readWeekScans({ siteId: site.siteId, weekStarts }),
    // A page we could not read is a page the row does not link to; the
    // question is still drawn, and its marks are still true. So this one
    // degrades rather than propagating — unlike the passes, which are the
    // screen's whole subject.
    readOwnPages(site.siteId).catch(() => new Map<string, AnswerPage>()),
  ]);

  const weeks: AnswerWeekFacts[] = [];
  for (const week of weekStarts) {
    const report = scans.get(week)?.report ?? null;
    const questions = questionsOf(report, site.domain, pages);
    if (questions === null) continue;
    weeks.push({ weekStart: mondayOf(week), questions });
  }

  return {
    weeks,
    // One date governs the whole blob (`src/lib/scan/report.ts`): the
    // verdict's own `measuredAt`, from the newest pass this window read.
    measuredAt: newest(scans, weekStarts),
  };
}

/** The window's Mondays, oldest first, in the site's own zone — the same
 *  `week_start` strings the weekly pass stamps its rows with. */
function windowWeeks(at: Date, timeZone: string): string[] {
  const weeks: string[] = [weekStartFor({ at, zone: timeZone })];
  for (let back = 1; back < ANSWER_RATE_WEEKS; back += 1) {
    weeks.unshift(previousWeekStart(weeks[0] as string));
  }
  return weeks;
}

/** A `week_start` as the instant a surface states it at. Midday UTC, so a
 *  Monday rendered in a zone either side of it is still that Monday — the
 *  same rule `store.ts` keeps for the growth series. */
function mondayOf(weekStart: string): Date {
  return new Date(`${weekStart}T12:00:00.000Z`);
}

/** One pass's twelve questions, or `null` where that pass stored no
 *  AI-answers section at all — a week that is absent from the window rather
 *  than a week of twelve misses. */
function questionsOf(
  report: StoredReport | null,
  ownDomain: string,
  pages: ReadonlyMap<string, AnswerPage>
): readonly AnswerQuestion[] | null {
  const section = report?.aiAnswers;
  if (section === undefined || section === null) return null;
  return section.rows.map((row): AnswerQuestion => {
    // The row's own AI-Overview cell **is** `engines[0]` (`matrix.ts`: one
    // measurement, two readings). A row stored before the engines triple
    // carries its cell alone, and is read as exactly that: the AI Overview
    // measured, the other two never reached.
    const columns = row.engines.length > 0 ? row.engines : [{ engine: "ai_overview", cell: row.cell }];
    const byEngine = new Map<string, AnswerCell>(columns.map((column) => [column.engine, column.cell]));
    return {
      n: row.question.n,
      wording: row.question.wording,
      search: row.question.search,
      marks: ANSWER_ENGINES.map((engine: AnswerEngine) => {
        const cell = byEngine.get(engine);
        return cell === undefined ? "not_measured" : markOf(cell, ownDomain);
      }),
      page: pages.get(normalise(row.question.search)) ?? null,
    };
  });
}

/** The newest pass in the window that stored a verdict, as its own
 *  measurement date. `null` where the window read none. */
function newest(
  scans: ReadonlyMap<string, { report: StoredReport | null }>,
  weeks: readonly string[]
): Date | null {
  for (let i = weeks.length - 1; i >= 0; i -= 1) {
    const report = scans.get(weeks[i] as string)?.report;
    if (report != null) return report.verdict.measuredAt;
  }
  return null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** §9's live pages, joined through the draft to the opportunity each was
 *  written for — the same predicate the Overview's count and the Search
 *  tab's two position tiles read: delivered, and not taken down. */
interface LivePageRow {
  live_url: string | null;
  unpublished_at: string | null;
  drafts: { title: string | null; opportunities: { target_query: string | null } | null } | null;
}

/** The customer's own page per question's search. Keyed by the search the
 *  opportunity targets, because that is the key a question carries
 *  (`StoredQuestion.search`); a search with two live pages keeps the first,
 *  so a row links to one page and never to a list. */
async function readOwnPages(siteId: string): Promise<ReadonlyMap<string, AnswerPage>> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from<LivePageRow>("publications")
    .select("live_url, unpublished_at, drafts(title, opportunities(target_query))")
    .eq("site_id", siteId)
    .not("published_at", "is", null);
  if (error !== null || data === null) throw new Error(`answers: live pages — ${error?.message ?? "no rows"}`);

  const pages = new Map<string, AnswerPage>();
  for (const row of data) {
    if (row.unpublished_at !== null || row.live_url === null) continue;
    const draft = row.drafts;
    const search = draft?.opportunities?.target_query ?? null;
    const title = draft?.title ?? null;
    if (search === null || title === null) continue;
    const key = normalise(search);
    if (!pages.has(key)) pages.set(key, { title, url: row.live_url });
  }
  return pages;
}

/** The one spelling a search is matched by across the two rows that carry
 *  it — the question's own, and the opportunity's target. Case and edge
 *  whitespace only: nothing else about a search is normalised anywhere in
 *  the product, and a second rule here would silently join two searches. */
function normalise(search: string): string {
  return search.trim().toLowerCase();
}
