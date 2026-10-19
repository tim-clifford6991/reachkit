// BUILD §12 — "weekly (score delta, AI answers delta, …)", read from the
// two weeks a delta is made of.
//
// §12's Monday digest opens with two **deltas**, not two levels, and a
// delta is a statement about a pair of measurements. So this module reads
// the week being reported and the week before it, and subtracts. It buys
// nothing, measures nothing and stores nothing: both weeks are already
// stored (`scans.report`, keyed `(site_id, week_start)`), and a digest
// that re-measured to state a movement would report a different week from
// the one it is announcing.
//
// **A delta needs two measurements, and where it has fewer it is
// `unmeasured`** — never zero. That is the one decision in this file and
// it is REQ-004's trichotomy applied to a difference: a measured zero
// means "we measured both weeks and nothing moved", which §12's omission
// rule prints, and an absent previous week means "there is no movement to
// state", which the rule omits. Collapsing them would tell a customer in
// their very first digest that nothing changed, in the week when there was
// nothing yet to change from.
//
// **Why here and not in the mail.** The mail lays out what it is handed
// (`templates/weekly/`), and the weekly leaf is where a week's stored
// report is read — `readWeekScan` and `accountForWeek` are its readers and
// this is a third one beside them. Putting the subtraction in the mail
// would make the template reach the database for two weeks, and would put
// the definition of "what moved" somewhere no other reader could find it.
//
// The previous week is **the calendar week before**, in the site's own
// zone: seven days back from this week's Monday, which is the same Monday
// `weekStartFor` would have computed then. A site that skipped a week has
// no row there and reads `unmeasured` — the honest answer, since the
// movement across a gap is not a week's movement.
import { classifyReferences } from "@/lib/measure/drivers";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { issueChanges, type IssueChange } from "@/lib/site-issues/changes";
import type { StoredReport } from "../report";
import { readWeekScan } from "./store";

/** §12's two opening figures. Both `Measured<number>`, so the mail's
 *  omission rule decides what is printed and this module decides nothing
 *  about presentation. */
export interface WeekMovement {
  readonly scoreDelta: Measured<number>;
  readonly aiAnswersDelta: Measured<number>;
  /** SPEC §8 (2026-09-20, #933): the levels those two deltas are the change
   *  in — the Monday mail states the number as well as its movement, as the
   *  Overview does. Read off the same stored week; `unmeasured` where the
   *  week did not reach one, so a mail states no number it does not have.
   *
   *  `searches` is the searches the site appears in, the third of the
   *  Overview's four. The fourth — pages live — is not a measurement of the
   *  week at all and is read where it is stored, by the mail's own
   *  occasion. */
  readonly score: Measured<number>;
  readonly aiAnswers: Measured<number>;
  readonly searches: Measured<number>;
  readonly searchesDelta: Measured<number>;
  /** SPEC §9 on Monday: the technical checks whose count moved since the
   *  week before. `unmeasured` where either week stored no checks — the
   *  same two-measurements-or-nothing rule as the deltas. */
  readonly issueChanges: Measured<readonly IssueChange[]>;
  /** SPEC §8 2026-09-29 (D16): the tracked questions whose answer names
   *  the site this week and did not the week before, each by the search it
   *  was phrased from. A question the week before did not ask, or could
   *  not read, is not listed: "now" is a comparison of two readings. */
  readonly nowNamed: readonly { readonly search: string }[];
  /** Issue 1551 (SEO review R5.1): the published pages' own questions this
   *  week whose AI answer links the site, out of those read — the AI tab's
   *  *Your pages cited*, by its rule (`classifyReferences`' citation over a
   *  cell's cited domains). `unmeasured` where the week read none. */
  readonly pagesCited: Measured<{ readonly cited: number; readonly asked: number }>;
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

/** The score this report reached, or `null` where the pass did not reach
 *  one. A score is `Measured` on the report itself, so an unmeasured week
 *  is not a zero here either. */
function scoreOf(report: StoredReport | null): number | null {
  if (report === null) return null;
  const band = report.verdict.scoreAndBand;
  return band.kind === "unmeasured" ? null : band.value.score;
}

/**
 * The customer's own citations in AI answers — the figure §12 calls "AI
 * answers".
 *
 * `customerCitations` and not `answeredSearches`: the second counts
 * searches an AI answer appeared on at all, which moves with the engines
 * rather than with the customer, and §4.5's own tile reads the customer's
 * citations. One reading, and this is it.
 */
function aiAnswersOf(report: StoredReport | null): number | null {
  if (report === null) return null;
  if (report.aiAnswers === null) return null;
  // Issue 869: the same rule the Overview tile reads by. A week whose AI
  // answers could not be read counts `0` citations over `0` answers, and a
  // `0` here becomes a measured delta — the Monday mail would print "AI
  // answers −3" for an engine outage. No denominator, no number.
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
  // Two measurements or nothing: see the module header.
  if (now === null || before === null) return unmeasured<number>("not_attempted", at);
  return measured(now - before, at);
}

/**
 * What moved for one site between the week before and the week being
 * reported.
 *
 * `at` is the date the digest states its figures as of — the week's own
 * measurement date, so every number in the mail carries the same one
 * (REQ-063 c4: "the date it was measured").
 */
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
    scoreDelta: deltaOf(scoreOf(now), scoreOf(before), a.at),
    aiAnswersDelta: deltaOf(aiAnswersOf(now), aiAnswersOf(before), a.at),
    // #933's levels, off the same two weeks. `levelOf` is `deltaOf`'s
    // one-sided twin: a week that did not reach the figure has none, and
    // says so rather than standing a zero in its place.
    score: levelOf(scoreOf(now), a.at),
    aiAnswers: levelOf(aiAnswersOf(now), a.at),
    searches: levelOf(searchesOf(now), a.at),
    searchesDelta: deltaOf(searchesOf(now), searchesOf(before), a.at),
    issueChanges: issueChanges(now?.siteIssues ?? null, before?.siteIssues ?? null, a.at),
    nowNamed: nowNamedOf(now, before),
    pagesCited: pagesCitedOf(now, a.at),
  };
}

/** The page questions any engine answered with a link to the site, over
 *  those any engine read. */
function pagesCitedOf(report: StoredReport | null, at: Date): Measured<{ cited: number; asked: number }> {
  const section = report?.pageQuestions ?? null;
  let asked = 0;
  let cited = 0;
  for (const row of section?.rows ?? []) {
    const cells = row.engines.length === 0 ? [row.cell] : row.engines.map((engine) => engine.cell);
    if (cells.every((cell) => cell.kind === "unmeasured")) continue;
    asked += 1;
    if (cells.some((cell) => cell.kind === "answered" && classifyReferences(cell.citedDomains, section?.ownDomain ?? "").cited)) cited += 1;
  }
  return asked === 0 ? unmeasured("not_attempted", at) : measured({ cited, asked }, at);
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
