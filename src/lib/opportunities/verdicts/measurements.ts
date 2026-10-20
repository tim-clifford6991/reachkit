// BUILD §9 — one week's stored report, read as the place each page's row
// records, what each tracked prompt's answers cited, and the gates and site
// checks a fix page is decided from. A projection: nothing is measured or
// re-counted, and a reading the week did not reach stays `unmeasured`.
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import { searchRowsFor, type SearchRows } from "@/lib/measure/page-reading";
import type { StoredReport } from "@/lib/scan/report";
import type { Barrier } from "../types";
import type { WeekMeasurements, WeekStart } from "./types";

/** One site-local week's readings, keyed as the judgement reads them. */
export function weekMeasurementsFrom(a: {
  report: StoredReport;
  week: WeekStart;
  /** Every published page's target search (issue 795). Each gets a key whether
   *  or not it is among this week's twelve, read from the site's own ranked
   *  rows where it is not — so no page's search is ever absent. */
  targets?: readonly string[];
  /** Issue 1548: the targets the outside keyword database measured demand
   *  for. Its ranked rows can say a page holds no place only on a search
   *  it tracks; on any other, a page no row holds is not measured. */
  withDemand?: readonly string[];
}): WeekMeasurements {
  const { report } = a;
  const at = report.verdict.measuredAt;

  const positions = new Map<string, Measured<SearchRows>>();

  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;

  for (const question of questions) {
    // Present whatever came back: a SERP the week could not read is an
    // `unmeasured` position, not a search that left the set.
    positions.set(question.search.keyword, searchRowsFor(report, question.search.keyword, { tracked: false }));
  }

  // Issue 1548: a target outside the twelve reads its page question's
  // Google result, then the ranked rows; those are complete only for a
  // search the keyword database tracks.
  const tracked = new Set([
    ...(a.withDemand ?? []).map(normalised),
    ...(report.market.kind === "unmeasured" ? [] : report.market.value.suggestions)
      .filter((row) => row.volume > 0)
      .map((row) => normalised(row.keyword)),
  ]);

  for (const target of a.targets ?? []) {
    if (positions.has(target)) continue;
    positions.set(target, searchRowsFor(report, target, { tracked: tracked.has(normalised(target)) }));
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
    promptCitations,
    gatesCleared: gatesFrom(report, at),
    siteIssues: report.siteIssues,
  };
}

function normalised(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
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
