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
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { StoredReport } from "../report";
import { readWeekScan } from "./store";

/** §12's two opening figures. Both `Measured<number>`, so the mail's
 *  omission rule decides what is printed and this module decides nothing
 *  about presentation. */
export interface WeekMovement {
  readonly scoreDelta: Measured<number>;
  readonly aiAnswersDelta: Measured<number>;
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
  return report.aiAnswers === null ? null : report.aiAnswers.customerCitations;
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
  };
}
