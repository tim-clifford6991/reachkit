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
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { AnswerCell, StoredReport } from "@/lib/scan/report";
import type { Barrier } from "../types";
import type { WeekMeasurements, WeekStart } from "./types";

/** The customer's own place on one measured SERP: the best position any
 *  row of their own domain holds, or a measured zero where the SERP was
 *  read and they hold none. Never a guess and never an absence — the SERP
 *  was measured, so "not there" is a measurement. */
function ownPlace(
  serp: { organic: readonly { position: number; domain: string }[] },
  ownDomain: string,
  at: Date
): Measured<number> {
  let best: number | null = null;
  for (const row of serp.organic) {
    if (!isOwnDomain(registrableDomain(row.domain) ?? row.domain, ownDomain)) continue;
    if (best === null || row.position < best) best = row.position;
  }
  return best === null ? measuredZero(0, at) : measured(best, at);
}

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
}): WeekMeasurements {
  const { report } = a;
  const at = report.verdict.measuredAt;
  const ownDomain = registrableDomain(report.domain) ?? report.domain;

  const positions = new Map<string, Measured<number>>();
  const namesCustomer = new Map<string, Measured<boolean>>();

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
        ? unmeasured<number>("not_attempted", at)
        : serpAt.kind === "unmeasured"
          ? unmeasured<number>(serpAt.reason, at)
          : ownPlace(serpAt.value, ownDomain, at)
    );

    const cell = answerRows[index]?.cell;
    namesCustomer.set(question.text, namedBy(cell, at));
  });

  return {
    week: a.week,
    measuredAt: at,
    domain: report.domain,
    positions,
    namesCustomer,
    gatesCleared: gatesFrom(report, at),
  };
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
