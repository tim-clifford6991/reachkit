// BUILD §11, §4.5 — the one account of a week that every surface reads
//
// REQ-065 criteria 2 to 5 as one total function. The shell, Overview, the
// calendar and the weekly mail all read this; none of them derives a
// second account of the same week, and none of them inspects a scan status
// itself. Four variants, and each maps onto a written line the registry
// already owns — `shell.domain.measured-weeks`,
// `shell.domain.not-measured`, `place.overview.weekly-presence.week` and
// `.partial-week`, `mail.week_unmeasured`, `mail.week_partly_measured`.
// **This module renders nothing and holds no copy**: it returns the state,
// the surface states the sentence.
//
// **A measured week outlives the subscription.** The row is read before
// the gate, so criterion 5's two halves both hold: a customer whose access
// has ended is told about no unmeasured week and is promised no next
// measurement (`not_owed`), and every week already measured still reads
// back complete or partly measured, with the date it was taken.
//
// **A degraded row is never `complete`.** Criterion 4: what was measured
// is shown with its date, what was not is named, and the week is never
// presented as a whole measurement. The parts come from the stored blob's
// own `Measured` arms — nothing here re-measures, re-counts or guesses at
// what a pass reached.
import { sitesWithActiveAccess } from "./access";
import { readSiteZone, readWeekScan } from "./store";
import type { StoredReport } from "../report";
import { nextDueAfter } from "./week";

/**
 * What a partly measured week did not reach, in the words the surfaces
 * name the sections by.
 *
 * WO-176's plan called the last member `verdicts`; it is `score` here,
 * because the page-by-page verdicts are REQ-063's (issue #47) — judged
 * *from* this measurement and not a part of it — and two different things
 * under one name is the merge ADR-071 forbids. The rest are the sections
 * the stored report carries, one name each.
 */
export type UnmeasuredPart = "on_page" | "market" | "rankings" | "ai_answers" | "rivals" | "score";

/** The declaration order, which is the order the parts are named in. */
const PARTS: readonly UnmeasuredPart[] = Object.freeze([
  "on_page",
  "market",
  "rankings",
  "ai_answers",
  "rivals",
  "score",
] as const);

export type WeekAccount =
  /** Criterion 2 — the whole week, with the date it was taken. */
  | { readonly kind: "complete"; readonly measuredAt: Date }
  /** Criterion 4 — measured, with the sections it did not reach named. */
  | {
      readonly kind: "partial";
      readonly measuredAt: Date;
      readonly unmeasured: readonly UnmeasuredPart[];
    }
  /** Criterion 3 — not measured, and the day the next one is due. */
  | { readonly kind: "not_measured"; readonly nextDueOn: Date }
  /** Criterion 5 — access has ended: no week is owed and none is announced. */
  | { readonly kind: "not_owed" };

/**
 * Which sections of a stored report a pass did not reach.
 *
 * Read off the blob's own arms and nothing else: `unmeasured` says a
 * measurement was not made, and a `zero` is a measurement — a customer who
 * ranks for nothing has a measured 0, not a missing section (§6.6's
 * cold-start law), and appears here in no part at all.
 */
export function unmeasuredPartsOf(report: StoredReport): readonly UnmeasuredPart[] {
  const missing = new Set<UnmeasuredPart>();
  if (report.onPage.kind === "unmeasured") missing.add("on_page");
  if (report.market.kind === "unmeasured") missing.add("market");
  if (report.rivals.kind === "unmeasured") missing.add("rivals");
  if (report.verdict.scoreAndBand.kind === "unmeasured") missing.add("score");
  // The twelve question-SERPs are the customer's own presence *and* the AI
  // answers: one purchase, two readings (§6.2). A pass that read none of
  // them reached neither.
  if (report.aiAnswers === null) missing.add("ai_answers");
  if (report.serps.length === 0 || report.serps.every((serp) => serp.kind === "unmeasured")) {
    missing.add("ai_answers");
    missing.add("rankings");
  }
  if (report.verdict.unmeasuredElsewhere.some((row) => row.input === "own_ranked_rows")) {
    missing.add("rankings");
  }
  return PARTS.filter((part) => missing.has(part));
}

/** REQ-065 c1's "the date it was taken, in that same time zone": the
 *  report's one date, which is the measurement's and not the storage's. */
function measuredAtOf(report: StoredReport | null, fallback: Date): Date {
  return report === null ? fallback : report.verdict.measuredAt;
}

export async function accountForWeek(a: {
  siteId: string;
  weekStart: string;
  /** Injected so the account is testable without travelling in time; it
   *  reaches only the `not_measured` arm's due date. */
  now?: Date;
}): Promise<WeekAccount> {
  const now = a.now ?? new Date();

  // The row first, so a week already measured reads back with its own date
  // however the subscription stands today (criterion 5, second half).
  const week = await readWeekScan({ siteId: a.siteId, weekStart: a.weekStart });
  if (week !== null && (week.status === "done" || week.status === "degraded")) {
    const measuredAt = measuredAtOf(week.report, now);
    const unmeasured = week.report === null ? PARTS : unmeasuredPartsOf(week.report);
    if (week.status === "done" && unmeasured.length === 0) return { kind: "complete", measuredAt };
    return { kind: "partial", measuredAt, unmeasured };
  }

  // No week, and nothing is owed where access has ended: no unmeasured
  // week is stated and no next measurement is announced.
  const withAccess = await sitesWithActiveAccess("accountForWeek", [a.siteId]);
  if (!withAccess.has(a.siteId)) return { kind: "not_owed" };

  return { kind: "not_measured", nextDueOn: await nextDueOn({ siteId: a.siteId, now }) };
}

/**
 * The day the next measurement is due, in the site's own zone — the one
 * date the shell, Overview and the weekly mail all state, so they cannot
 * state two.
 *
 * A site with no stored zone has no local Monday, and so no week: no
 * caller can have computed a `weekStart` for it either. That is a
 * programming error rather than a state to render, and it says so.
 */
export async function nextDueOn(a: { siteId: string; now: Date }): Promise<Date> {
  const zone = await readSiteZone(a.siteId);
  if (zone === null) {
    throw new Error(
      `src/lib/scan/weekly/account.ts: site ${a.siteId} has stated no time zone, so no ` +
        "local Monday and no next measurement can be named for it (REQ-073 c1)."
    );
  }
  return nextDueAfter({ at: a.now, zone });
}
