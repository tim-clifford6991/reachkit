// The two reads behind the page questions: a published page's own question may join the tracked set (at most 24 in all, those nearest the first page),
// and leaves after `PAGE_QUESTION_RETIRE_WEEKS` without a mention. The arithmetic is `src/lib/market/questions/tracked.ts`, pure; this file answers it:
// the candidates   live publications joined through the draft to their opportunity, carrying its question, its search and the page's stored reading;
// the misses       the site's last `PAGE_QUESTION_RETIRE_WEEKS` weekly reports' `pageQuestions` sections.
// No new table: both facts are already stored, and a copy could fall behind them.
// Every read degrades to nothing: an unreadable list is no page questions this week, never an invented row or a throw out of a paid pass.
import { dbAdmin } from "@/lib/db";
import { PAGE_QUESTION_RETIRE_WEEKS } from "@/lib/config/constants";
import { classifyReferences } from "@/lib/measure/drivers";
import { readingOf } from "@/lib/measure/page-reading";
import { templateQuestion } from "@/lib/market/questions/template";
import type { MissesByPage, PageQuestionCandidate } from "@/lib/market/questions/tracked";
import { missesByPage } from "@/lib/market/questions/tracked";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";
import { readStoredReport, type PageQuestionsSection, type StoredReport } from "./report";

/** `scans.week_start` and the join shapes below are not in the generated `Database` type, so these two reads go through a narrow cast. Nothing else here bypasses the type. */
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
  published_at: string | null;
  unpublished_at: string | null;
  search_reading: unknown;
  drafts: {
    opportunities: { target_query: string | null; acceptance: unknown } | null;
  } | null;
}

/** Every live page that could carry a tracked question, each with the place its target search holds.
 *  One question per page, its own: the opportunity's asked-as form, else `templateQuestion` of its search, as `askedAs` states it elsewhere.
 *  The place is the page's stored reading, else this pass's ranked rows, so it costs nothing; `null` where neither holds it, which keeps the page.
 *  The order is `trackedQuestions`'s, not decided here. `[]` where no live page, and on any failure. */
export async function pageQuestionCandidates(a: {
  siteId: string;
  ownRankedRows: readonly RankedRow[];
}): Promise<readonly PageQuestionCandidate[]> {
  const { data, error } = await untyped()
    .from<LivePageRow>("publications")
    .select("id, live_url, destination, published_at, unpublished_at, search_reading, drafts(opportunities(target_query, acceptance))")
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

  // The page a tracked question is asked about is named at its site's host now, the address an answer would cite. A site with no page costs no read.
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
    const reading = readingOf(row.search_reading);
    candidates.push({
      publicationId: row.id,
      liveUrl:
        addressNow === null ? row.live_url : addressNow({ destination: row.destination, liveUrl: row.live_url }),
      question: askedAsOf(opportunity?.acceptance, search),
      search,
      position: reading?.place?.value ?? places.get(key) ?? null,
      publishedAt: row.published_at ?? null,
      linked: (reading?.linkedBy ?? []).length > 0,
      unread: reading === null,
    });
  }
  return candidates;
}

/** The opportunity's own asked-as form: its acceptance test's question, else the search's template question.
 *  The rule `askedAs` states, written over the stored `jsonb` because the app's projection does not reach this job. */
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

/** How many weekly passes running asked each page's question and heard nothing, over the last `PAGE_QUESTION_RETIRE_WEEKS` weekly reports.
 *  A week counts only where it answered: an all-`unmeasured` row is the pass's failure, not a miss.
 *  An empty map on any failure retires nothing: a question kept a week longer costs 0.3¢, a wrongly retired one loses its slot for good. */
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

/** One week as the retirement rule reads it: the pages it got an answer about, and those an answer named or linked (`classifyReferences`, the score's own).
 *  A mention on any of the three engines is a mention. */
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
