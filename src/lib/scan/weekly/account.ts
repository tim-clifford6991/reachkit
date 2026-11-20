// BUILD §11, §4.5: the one account of a week that the shell, Overview, the calendar and the weekly mail read; none derives a second or inspects
// a scan status itself. It returns the state; each surface states the sentence.
// A measured week outlives the subscription: the row is read before the gate, so a customer whose access ended is owed nothing new (`not_owed`)
// and every measured week still reads back with its date.
// A degraded row is never `complete`: what was measured shows with its date and what was not is named, from the blob's own `Measured` arms.
import { hasActiveAccess } from "@/lib/account/billing";
import { readSiteZone, readWeekScan } from "./store";
import type { StoredReport } from "../report";
import { nextDueAfter } from "./week";

/** What a partly measured week did not reach, named as the surfaces name the sections. `score`, not `verdicts`: the page verdicts are judged
 *  from this measurement, not part of it. */
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
  /** The whole week, with the date it was taken. */
  | { readonly kind: "complete"; readonly measuredAt: Date }
  /** Measured, with the sections it did not reach named. */
  | {
      readonly kind: "partial";
      readonly measuredAt: Date;
      readonly unmeasured: readonly UnmeasuredPart[];
    }
  /** Not measured, and the day the next one is due. */
  | { readonly kind: "not_measured"; readonly nextDueOn: Date }
  /** Access has ended: no week is owed and none is announced. */
  | { readonly kind: "not_owed" };

/** Which sections a pass did not reach, from the blob's own arms: `unmeasured` is a measurement not made, while a `zero` (ranking for nothing) is measured. */
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
  // A section that exists and read no answer at all is as unmeasured as an absent one: the customer is told it is missing, not shown a zero.
  if (report.aiAnswers !== null && report.aiAnswers.measuredSearches === 0) missing.add("ai_answers");
  if (report.serps.length === 0 || report.serps.every((serp) => serp.kind === "unmeasured")) {
    missing.add("ai_answers");
    missing.add("rankings");
  }
  if (report.verdict.unmeasuredElsewhere.some((row) => row.input === "own_ranked_rows")) {
    missing.add("rankings");
  }
  return PARTS.filter((part) => missing.has(part));
}

/** "The date it was taken, in that same time zone": the report's one date, the measurement's and not the storage's. */
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

  // The row first, so a week already measured reads back with its own date however the subscription stands today.
  const week = await readWeekScan({ siteId: a.siteId, weekStart: a.weekStart });
  if (week !== null && (week.status === "done" || week.status === "degraded")) {
    const measuredAt = measuredAtOf(week.report, now);
    const unmeasured = week.report === null ? PARTS : unmeasuredPartsOf(week.report);
    if (week.status === "done" && unmeasured.length === 0) return { kind: "complete", measuredAt };
    return { kind: "partial", measuredAt, unmeasured };
  }

  // No week, and nothing is owed where access has ended: no unmeasured
  // week is stated and no next measurement is announced.
  if (!(await hasActiveAccess(a.siteId))) return { kind: "not_owed" };

  return { kind: "not_measured", nextDueOn: await nextDueOn({ siteId: a.siteId, now }) };
}

/** The day the next measurement is due in the site's zone, the one date every surface states. A site with no zone has no week: a programming error, so it throws. */
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
