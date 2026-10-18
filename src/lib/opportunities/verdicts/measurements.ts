// BUILD §9 — one week's stored report, read as the three readings the
// three acceptance forms are decided from.
//
// A projection and nothing else: no measurement is made here, nothing is
// re-counted, and no value is invented. Every reading is copied out of the
// week's own `StoredReport` with the arm and the date it was measured
// under, so a page is judged against this week's measurement and never
// against a figure derived a second way.
//
// **The distinction this file exists to keep is absent-key versus
// `unmeasured` value.** A key that is absent says the thing the test names
// left the tracked set — terminal, and `evaluateAcceptance` reads it as
// one of the five causes. A key that is present carrying an `unmeasured`
// value says this week did not reach it — transient, `not_measured`, and
// nothing is written down. So every question and every search the week
// still tracks gets a key, whether or not the measurement came back:
// dropping the key for a SERP that failed would retire a live page
// forever on the strength of one missed request (ADR-072 decision 5).
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { AnswerCell, StoredReport } from "@/lib/scan/report";
import type { Barrier } from "../types";
import type { PlacedUrl, SearchRows, WeekMeasurements, WeekStart } from "./types";

/**
 * REQ-063 c1's "the week beginning on Monday in the time zone the customer
 * set", as the three maps a recorded test is decided from.
 *
 * The `questions` / `serps` / `aiAnswers.rows` arrays are the scan's own
 * parallel record of one battery and are paired positionally — the same
 * pairing `src/lib/opportunities/derive/write.ts` reads, and the same one
 * the acceptance tests were written under, so a test recorded from index
 * *i* is decided from index *i*.
 */
export function weekMeasurementsFrom(a: {
  report: StoredReport;
  week: WeekStart;
  /** Every published page's target search (issue 795). Each gets a key whether
   *  or not it is among this week's twelve, read from the site's own ranked
   *  rows where it is not — so no page's search is ever absent. */
  targets?: readonly string[];
}): WeekMeasurements {
  const { report } = a;
  const at = report.verdict.measuredAt;

  const positions = new Map<string, Measured<SearchRows>>();
  const namesCustomer = new Map<string, Measured<boolean>>();
  const ownPagesCited = new Map<string, Measured<readonly string[]>>();

  // `questions` is what says which searches and which questions the week
  // still tracks. Where it was not measured at all, no search and no
  // question has a key — every page whose test names one reads
  // `search_untracked` or `question_left_set`… which would be wrong, and
  // is why the caller never reaches this function for a week with no
  // report at all: a week that measured no questions is `no_week`, and
  // `judgeWeek` answers that before it asks for measurements.
  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  const answerRows = report.aiAnswers?.rows ?? [];

  questions.forEach((question, index) => {
    const serpAt = report.serps[index];
    const query = question.search.keyword;
    // Present whatever came back: a SERP the week could not read is an
    // `unmeasured` position, not a search that left the set.
    positions.set(
      query,
      serpAt === undefined
        ? unmeasured<SearchRows>("not_attempted", at)
        : serpAt.kind === "unmeasured"
          ? unmeasured<SearchRows>(serpAt.reason, at)
          : measured<SearchRows>(
              {
                serp: serpAt.value.organic.map((row) => ({ url: row.url, position: row.position })),
                // Issue 1518: the SERP is bought ten deep, so a page at 11–20
                // is read from the ranked rows before it reads as absent.
                ranked: report.ownRanked.kind === "unmeasured" ? [] : rankedRowsFor(report, query),
                complete: true,
              },
              at
            )
    );

    const cell = answerRows[index]?.cell;
    namesCustomer.set(question.text, namedBy(cell, at));
    ownPagesCited.set(question.text, ownPagesBy(cell, at));
  });

  // **A page's own question is a tracked question** (SPEC §6 2026-09-20,
  // #919). The page questions are stored beside the twelve, and a page
  // whose acceptance test names its own question is decided from the row
  // this pass asked for it — without this, every such page read
  // `question_left_set`, which is terminal: the page would be retired for
  // asking the one question the product now puts to the engines on its
  // behalf. The twelve win a collision, because a question the market also
  // selected was measured as one of the twelve and that is the reading the
  // test was recorded under.
  for (const row of report.pageQuestions?.rows ?? []) {
    const wording = row.question.wording.text;
    if (namesCustomer.has(wording)) continue;
    namesCustomer.set(wording, namedBy(row.cell, at));
    ownPagesCited.set(wording, ownPagesBy(row.cell, at));
  }

  for (const target of a.targets ?? []) {
    if (!positions.has(target)) positions.set(target, rankedRows(report, target, at));
  }

  // SPEC §6 (D60, issue 1288): what each tracked prompt's answers cited,
  // over every engine and run the week asked it on.
  const promptCitations = new Map<string, Measured<readonly string[]>>();
  for (const asked of report.prompts?.asked ?? []) {
    const answers = (report.prompts?.answers ?? []).filter((answer) => answer.promptId === asked.id);
    const cited = [...new Set(answers.flatMap((answer) => answer.ownUrls))];
    promptCitations.set(
      asked.id,
      answers.length === 0
        ? unmeasured<readonly string[]>("not_attempted", at)
        : cited.length === 0
          ? measuredZero<readonly string[]>([], at)
          : measured<readonly string[]>(cited, at)
    );
  }

  return {
    week: a.week,
    measuredAt: at,
    domain: report.domain,
    positions,
    namesCustomer,
    ownPagesCited,
    promptCitations,
    gatesCleared: gatesFrom(report, at),
    siteIssues: report.siteIssues,
  };
}

/**
 * The tracked-target read (issue 795): the rows for a search that is not
 * among this week's twelve, from the ranked rows the pass bought for its
 * count — no call is made for it.
 *
 * - The count was not measured this week: not measured, which is transient
 *   and writes nothing.
 * - Otherwise the rows that name the search, and whether they are every
 *   search the site ranks for: a page missing from a capped purchase, or
 *   from a report that kept none, is not measured rather than absent.
 */
function rankedRows(report: StoredReport, target: string, at: Date): Measured<SearchRows> {
  if (report.ownRanked.kind === "unmeasured") return unmeasured<SearchRows>(report.ownRanked.reason, at);
  return measured<SearchRows>(
    {
      serp: null,
      ranked: rankedRowsFor(report, target),
      complete: report.ownRanked.value <= report.ownRankedRows.length,
    },
    at
  );
}

function rankedRowsFor(report: StoredReport, query: string): PlacedUrl[] {
  const wanted = normalised(query);
  return report.ownRankedRows
    .filter((row) => normalised(row.keyword) === wanted)
    .map((row) => ({ url: row.url, position: row.position }));
}

function normalised(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** One matrix cell, as the `named_on` form reads it. An `unmeasured` cell
 *  "lowers the denominator and is never counted as a place the customer
 *  was ignored" (`AnswerCell`'s own words), so it is carried as an
 *  unmeasured reading and never as a measured `false`. "No answer" is the
 *  opposite: the AI answered nobody, which is a measured result. */
function namedBy(cell: AnswerCell | undefined, at: Date): Measured<boolean> {
  if (cell === undefined) return unmeasured<boolean>("not_attempted", at);
  switch (cell.kind) {
    case "unmeasured":
      return unmeasured<boolean>(cell.reason, at);
    case "no_answer":
      return measuredZero(false, at);
    case "answered":
      return measured(cell.namesCustomer, at);
  }
}

/** The same cell, as the site's own pages its answer cited (SPEC §4
 *  2026-09-29, D16). "No answer" cited nothing, which is measured. An
 *  answered cell that kept no addresses — one stored before they were read
 *  — is unmeasured: it cannot say which page was cited, so it credits none
 *  and fails none. */
function ownPagesBy(cell: AnswerCell | undefined, at: Date): Measured<readonly string[]> {
  if (cell === undefined) return unmeasured<readonly string[]>("not_attempted", at);
  switch (cell.kind) {
    case "unmeasured":
      return unmeasured<readonly string[]>(cell.reason, at);
    case "no_answer":
      return measuredZero<readonly string[]>([], at);
    case "answered":
      if (cell.ownUrls === undefined) return unmeasured<readonly string[]>("undeterminable", at);
      return cell.ownUrls.length === 0 ? measuredZero<readonly string[]>([], at) : measured(cell.ownUrls, at);
  }
}

/**
 * Whether each barrier the scan can observe is cleared this week.
 *
 * Three of the five are measured today, and they are read off exactly the
 * facts `derive/fix.ts` derives an `unblock` from — one reading of the
 * robots policy and the home document, not a second parse of either.
 * `login_wall` and `js_only` are storable members of the closed set that
 * nothing produces (there is no headless browser, §6), so they get no key:
 * a gate the product does not look at is `not_measured`, and a page whose
 * test names one is never judged on a guess.
 */
function gatesFrom(report: StoredReport, at: Date): ReadonlyMap<Barrier, Measured<boolean>> {
  const gates = new Map<Barrier, Measured<boolean>>();

  if (report.robots.kind === "unmeasured") {
    gates.set("robots_disallow", unmeasured<boolean>(report.robots.reason, at));
    gates.set("blocked_ai_agent", unmeasured<boolean>(report.robots.reason, at));
  } else {
    gates.set("robots_disallow", measured(!report.robots.value.disallowsAll, at));
    // The same closed list of readers the report's own `blockedAgents` is
    // derived from, read once and not recounted here.
    gates.set("blocked_ai_agent", measured(report.blockedAgents.length === 0, at));
  }

  if (report.onPage.kind === "unmeasured") {
    gates.set("noindex", unmeasured<boolean>(report.onPage.reason, at));
  } else {
    const facts = report.onPage.value;
    gates.set("noindex", measured(!(facts.noindex && facts.noindexAppliesToEveryReader), at));
  }

  return gates;
}
