// SPEC §6 (2026-09-20, #908 · #919) — the two reads behind the page
// questions, and nothing else.
//
// "Each published page's own question may join the tracked set: at most 24
// tracked questions in all (the twelve plus twelve), the twelve page
// questions being those whose pages rank nearest the first page, and a
// page's question leaves the set after 8 weeks without a mention."
//
// The **arithmetic** of that sentence — which candidates fit, which have
// run out of weeks — is `src/lib/market/questions/tracked.ts`, pure and
// tested with no database. This file is the pair of reads that answers it:
//
//   the candidates   §9's live publications, joined through the draft to
//                    the opportunity each was written for, so a page
//                    carries the question it was written to be the answer
//                    to (the opportunity's asked-as form) and the search it
//                    targets. Ranked by where that search stands for the
//                    site, which the pass has already measured
//                    (`ownRankedRows`) and does not buy again.
//   the misses       the site's own last `PAGE_QUESTION_RETIRE_WEEKS`
//                    weekly reports, read for their `pageQuestions` section.
//
// **No new table and no migration.** Both facts are already on disk: the
// pages are `publications`, and the weeks a question was asked without a
// mention are in the stored reports of those weeks. A `page_questions`
// table would be a second copy of both, kept in step by a writer that could
// fall behind them.
//
// **Every read here degrades to nothing.** A pass is a measurement, and a
// database that will not answer about published pages must not take one
// down: an unreadable candidate list is no page questions this week, which
// is exactly what the section then says — never an invented row, and never
// a throw out of the middle of a paid pass.
import { dbAdmin } from "@/lib/db";
import { PAGE_QUESTION_RETIRE_WEEKS } from "@/lib/config/constants";
import { classifyReferences } from "@/lib/measure/drivers";
import { templateQuestion } from "@/lib/market/questions/template";
import type { MissesByPage, PageQuestionCandidate } from "@/lib/market/questions/tracked";
import { missesByPage } from "@/lib/market/questions/tracked";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import { readStoredReport, type PageQuestionsSection, type StoredReport } from "./report";

/** `scans.week_start` and the join shapes below are on disk and not in the
 *  generated `Database` type, so these two reads go through the same
 *  narrow, explicitly cast builder `report.ts`, `admission.ts` and
 *  `weekly/store.ts` already carry. Nothing else here bypasses the type. */
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: unknown): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: unknown): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface LivePageRow {
  id: string;
  live_url: string | null;
  destination: string | null;
  unpublished_at: string | null;
  drafts: {
    opportunities: { target_query: string | null; acceptance: unknown } | null;
  } | null;
}

/**
 * Every live page that could carry a tracked question, each with the place
 * its target search holds.
 *
 * **One question per page, and it is the page's own.** The asked-as form is
 * the opportunity's: a page written to be the answer to *"what CRM should a
 * small team use?"* is tracked on that question and not on a question
 * composed here. Where the opportunity recorded no question — a target
 * chosen on its search rather than on an answer — the search's own template
 * question stands in, which is `templateQuestion`: code, deterministic, and
 * the same form the calendar and the draft screen already state for such a
 * page (`askedAs`).
 *
 * **The place comes from `ownRankedRows`** — the ranked rows this pass has
 * already bought (§6.6's cold-start read), so knowing which pages are
 * nearest the first page costs nothing. `null` where the rows hold that
 * search nowhere: the site ranks nowhere we can see for it, which is not a
 * position of zero and not a reason to drop the page, because a page nobody
 * ranks for is exactly the page an AI answer might still name.
 *
 * **The order is not decided here.** These come back in the order the
 * database gave them; *which* of them are asked, and in what order, is
 * `trackedQuestions` — one home for the rule, and it is pure.
 *
 * Returns `[]` where the site has no live page, and on any failure.
 */
export async function pageQuestionCandidates(a: {
  siteId: string;
  ownRankedRows: readonly RankedRow[];
}): Promise<readonly PageQuestionCandidate[]> {
  const { data, error } = await untyped()
    .from<LivePageRow>("publications")
    .select("id, live_url, destination, unpublished_at, drafts(opportunities(target_query, acceptance))")
    .eq("site_id", a.siteId)
    .not("published_at", "is", null);
  if (error !== null || data === null) return [];

  // The best place the site holds for each search it ranks for. Best, not
  // last: `ownRankedRows` can carry one keyword twice where two of the
  // site's own pages rank for it, and the page question's order is about
  // how near the first page that *search* is.
  const places = new Map<string, number>();
  for (const row of a.ownRankedRows) {
    const key = normalise(row.keyword);
    const held = places.get(key);
    if (held === undefined || row.position < held) places.set(key, row.position);
  }

  // SPEC §7 (2026-09-18): the page a tracked question is asked about is
  // named at its site's host now, which is the address an answer would cite.
  // A site with no page costs no read.
  const { hostedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const addressNow = data.length === 0 ? null : await hostedAddressesNow(a.siteId).catch(() => null);

  const candidates: PageQuestionCandidate[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    if (row.unpublished_at !== null || row.live_url === null) continue;
    const opportunity = row.drafts?.opportunities ?? null;
    const search = opportunity?.target_query ?? null;
    if (search === null || search.trim() === "") continue;
    // One question per search, whatever the site has published: two pages
    // on one search would buy the same answer twice and spend two of the
    // twenty-four slots saying it.
    const key = normalise(search);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      publicationId: row.id,
      liveUrl:
        addressNow === null ? row.live_url : addressNow({ destination: row.destination, liveUrl: row.live_url }),
      question: askedAsOf(opportunity?.acceptance, search),
      search,
      position: places.get(key) ?? null,
    });
  }
  return candidates;
}

/** The opportunity's own asked-as form: the question its acceptance test
 *  names where it named one, and the search's template question otherwise.
 *  The same rule `askedAs` states for the calendar and the draft screen —
 *  written here over the stored `jsonb` because this runs in a job, where
 *  the app's projection of an opportunity does not reach. */
function askedAsOf(acceptance: unknown, search: string): string {
  if (
    typeof acceptance === "object" &&
    acceptance !== null &&
    (acceptance as { form?: unknown }).form === "named_on" &&
    typeof (acceptance as { question?: unknown }).question === "string" &&
    (acceptance as { question: string }).question.trim() !== ""
  ) {
    return (acceptance as { question: string }).question;
  }
  return templateQuestion(search);
}

interface WeekReportRow {
  week_start: string;
  report: unknown;
}

/**
 * How many weekly passes running have asked each page's question and heard
 * nothing, newest week first.
 *
 * It reads the site's own last `PAGE_QUESTION_RETIRE_WEEKS` weekly reports
 * — the window the rule is stated over, so a question cannot retire on a
 * history longer than the rule and cannot survive one shorter.
 *
 * **A week is only counted where it answered.** A row whose every engine
 * came back `unmeasured` is a week nobody measured that page, not a week
 * the answer was no, and counting it would retire a question for the
 * pass's own failure. `missesByPage` is handed the pages a week *answered*
 * for, and decides the run from those.
 *
 * Returns an empty map on any failure: no miss is counted, which retires
 * nothing. The honest direction — a question kept a week longer costs
 * 0.3¢, and one retired on a database error loses its slot for good.
 */
export async function pageQuestionMisses(siteId: string): Promise<MissesByPage> {
  const { data, error } = await untyped()
    .from<WeekReportRow>("scans")
    .select("week_start, report")
    .eq("site_id", siteId)
    .eq("tier", "weekly")
    .not("report", "is", null)
    .order("week_start", { ascending: false })
    .limit(PAGE_QUESTION_RETIRE_WEEKS);
  if (error !== null || data === null) return new Map();

  const weeks: { asked: string[]; mentioned: string[] }[] = [];
  for (const row of data) {
    const section = sectionOf(row.report);
    if (section === null) continue;
    weeks.push(weekOf(section));
  }
  return missesByPage(weeks);
}

/** One stored week's page-questions section, or `null` where that week
 *  stored none or the blob could not be read. A report this build cannot
 *  read is not a week that missed: it is a week we know nothing about. */
function sectionOf(blob: unknown): PageQuestionsSection | null {
  if (blob === null || blob === undefined) return null;
  let report: StoredReport;
  try {
    report = readStoredReport(blob);
  } catch {
    return null;
  }
  return report.pageQuestions;
}

/** One week as the retirement rule reads it: the pages it got an answer
 *  about, and the ones an answer named or linked.
 *
 *  *Named or linked* is `classifyReferences` — the score's own function,
 *  the one the AI answers tab splits its two marks with. A mention is a
 *  mention on **any** of the three engines: the rule is "8 weeks without a
 *  mention", and an answer on one engine is a mention. */
function weekOf(section: PageQuestionsSection): { asked: string[]; mentioned: string[] } {
  const asked: string[] = [];
  const mentioned: string[] = [];
  for (const row of section.rows) {
    const cells = row.engines.length > 0 ? row.engines.map((column) => column.cell) : [row.cell];
    const answered = cells.filter((cell) => cell.kind !== "unmeasured");
    if (answered.length === 0) continue;
    asked.push(row.publicationId);
    const named = answered.some((cell) => {
      if (cell.kind !== "answered") return false;
      const { cited, mentioned: named } = classifyReferences(cell.citedDomains, section.ownDomain);
      return cited || named || cell.named === true;
    });
    if (named) mentioned.push(row.publicationId);
  }
  return { asked, mentioned };
}

/** The one spelling a search is matched by here — case and edge whitespace,
 *  the same rule the AI answers tab matches a question to its page with.
 *  Nothing else about a search is normalised anywhere in the product. */
function normalise(search: string): string {
  return search.trim().toLowerCase();
}
