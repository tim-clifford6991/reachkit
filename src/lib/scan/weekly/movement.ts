// BUILD §12: the Monday digest's deltas ("score delta, AI answers delta, …"), read from the two stored weeks a delta is made of and subtracted.
// It buys, measures and stores nothing. A delta needs two measurements and is otherwise `unmeasured`, never zero: a measured zero says nothing moved,
// which the mail prints; a first digest has nothing to change from, which the mail omits.
// Here, not in the mail, so the template never reaches the database and "what moved" has one definition.
// The previous week is the calendar week before in the site's zone; a skipped week reads `unmeasured`, since movement across a gap is not a week's.
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { issueChanges, type IssueChange } from "@/lib/site-issues/changes";
import type { StoredReport } from "../report";
import { shownScore } from "../shown-score";
import { readWeekScan } from "./store";

/** §12's two opening figures. Both `Measured<number>`, so the mail's
 *  omission rule decides what is printed and this module decides nothing
 *  about presentation. */
export interface WeekMovement {
  readonly scoreDelta: Measured<number>;
  readonly aiAnswersDelta: Measured<number>;
  /** The levels those deltas are the change in, so the mail states the number as well as its movement, as Overview does; `unmeasured` where the week reached none.
   *  `searches` is the searches the site appears in. Pages live is not a measurement of the week and is read where it is stored. */
  readonly score: Measured<number>;
  readonly aiAnswers: Measured<number>;
  readonly searches: Measured<number>;
  readonly searchesDelta: Measured<number>;
  /** The technical checks whose count moved since the week before; `unmeasured` where either week stored no checks, as the deltas' rule. */
  readonly issueChanges: Measured<readonly IssueChange[]>;
  /** The tracked questions whose answer names the site this week and did not the week before, by search. One the week before did not ask or read is not listed. */
  readonly nowNamed: readonly { readonly search: string }[];
}

const MS_PER_DAY = 86_400_000;

/** The Monday seven days before this one, as a calendar date. Computed at
 *  midday so a zone whose offset shifts by an hour cannot land the step on
 *  the day before or after. */
export function previousWeekStart(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const midday = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return new Date(midday - 7 * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The customer's own citations in AI answers, the figure the digest calls "AI answers": `customerCitations`, not `answeredSearches`,
 *  which moves with the engines rather than the customer. */
function aiAnswersOf(report: StoredReport | null): number | null {
  if (report === null) return null;
  if (report.aiAnswers === null) return null;
  // The same rule the Overview tile reads by: a week whose AI answers could not be read would print a measured delta for an engine outage. No denominator, no number.
  if (report.aiAnswers.measuredSearches === 0) return null;
  return report.aiAnswers.customerCitations;
}

/** The searches the site appears in, as the week measured it — the
 *  Overview's own third number (`ownRanked`, the count the pass stores).
 *  `null` where the week did not measure it. */
function searchesOf(report: StoredReport | null): number | null {
  const own = report?.ownRanked;
  if (own === undefined || own.kind === "unmeasured") return null;
  return own.value;
}

/** One measurement or nothing — the one-sided form of the rule below. */
function levelOf(now: number | null, at: Date): Measured<number> {
  return now === null ? unmeasured<number>("not_attempted", at) : measured(now, at);
}

function deltaOf(now: number | null, before: number | null, at: Date): Measured<number> {
  // Two measurements or nothing.
  if (now === null || before === null) return unmeasured<number>("not_attempted", at);
  return measured(now - before, at);
}

/** What moved for one site between the week before and the week reported. `at` is the week's measurement date, so every number in the mail carries one date. */
export async function weekMovement(a: {
  siteId: string;
  weekStart: string;
  at: Date;
}): Promise<WeekMovement> {
  const [thisWeek, lastWeek] = await Promise.all([
    readWeekScan({ siteId: a.siteId, weekStart: a.weekStart }),
    readWeekScan({ siteId: a.siteId, weekStart: previousWeekStart(a.weekStart) }),
  ]);

  const now = thisWeek?.report ?? null;
  const before = lastWeek?.report ?? null;

  return {
    scoreDelta: deltaOf(shownScore(now), shownScore(before), a.at),
    aiAnswersDelta: deltaOf(aiAnswersOf(now), aiAnswersOf(before), a.at),
    // The levels, off the same two weeks: a week that did not reach a figure has none, never a zero.
    score: levelOf(shownScore(now), a.at),
    aiAnswers: levelOf(aiAnswersOf(now), a.at),
    searches: levelOf(searchesOf(now), a.at),
    searchesDelta: deltaOf(searchesOf(now), searchesOf(before), a.at),
    issueChanges: issueChanges(now?.siteIssues ?? null, before?.siteIssues ?? null, a.at),
    nowNamed: nowNamedOf(now, before),
  };
}

/** Each tracked question's AI-Overview reading, the twelve and the page
 *  questions, keyed by its search: named, not named, or absent where the
 *  week did not read it. */
function namedBySearch(report: StoredReport | null): ReadonlyMap<string, { search: string; named: boolean }> {
  const out = new Map<string, { search: string; named: boolean }>();
  for (const row of [...(report?.aiAnswers?.rows ?? []), ...(report?.pageQuestions?.rows ?? [])]) {
    if (row.cell.kind === "unmeasured") continue;
    const key = row.question.search.trim().toLowerCase();
    if (out.has(key)) continue;
    out.set(key, { search: row.question.search, named: row.cell.kind === "answered" && row.cell.namesCustomer });
  }
  return out;
}

function nowNamedOf(now: StoredReport | null, before: StoredReport | null): readonly { search: string }[] {
  const earlier = namedBySearch(before);
  const out: { search: string }[] = [];
  for (const [key, reading] of namedBySearch(now)) {
    if (reading.named && earlier.get(key)?.named === false) out.push({ search: reading.search });
  }
  return out;
}
