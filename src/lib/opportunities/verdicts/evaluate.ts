// BUILD §9 — can this week decide a fix page's recorded test?
//
// Pure: no clock, no database, no network, no model. A page placed on a
// search or a question is labelled from its reading (`verdict.ts`); only a
// gate or a site check is decided from the week's own measurement here.
import { measured, type Measured } from "@/lib/measure/measured";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import type { Acceptance, PageFix } from "../types";
import type { WeekMeasurements } from "./types";

/** Decided, or this week's transient miss, which writes no row. */
export type Evaluation =
  | { readonly decided: true; readonly passes: boolean; readonly measuredAt: Date }
  | { readonly decided: false; readonly because: "not_measured" };

/** A measurement this week did not reach decides nothing. */
function decide<T>(
  value: Measured<T>,
  passes: (m: { value: T }) => boolean
): Evaluation {
  if (value.kind === "unmeasured") return { decided: false, because: "not_measured" };
  return { decided: true, passes: passes(value), measuredAt: value.at };
}

/** REQ-063 c5's transient arm, written once. */
const NOT_MEASURED: Evaluation = Object.freeze({ decided: false, because: "not_measured" as const });

/**
 * Whether every named check passes for one page this week. Decided only
 * where the week checked that page and every named check ran with its
 * addresses recorded; anything less is this week's miss, never a pass.
 */
export function pageFixesCleared(
  section: SiteIssuesSection | null,
  issues: readonly PageFix[],
  pageUrl: string,
  at: Date
): Measured<boolean> | null {
  if (section === null || section.checkedPages === null) return null;
  if (!section.checkedPages.includes(pageUrl)) return null;
  for (const check of issues) {
    const issue = section.issues.find((i) => i.check === check);
    if (issue === undefined || !issue.ran || issue.pages === null) return null;
    if (issue.pages.includes(pageUrl)) return measured(false, at);
  }
  return measured(true, at);
}

/** Pure. Whether this week decides a gate or a site check, and how. */
export function evaluateAcceptance(a: {
  acceptance: Extract<Acceptance, { form: "gate_cleared" | "issues_cleared" }>;
  week: WeekMeasurements;
}): Evaluation {
  switch (a.acceptance.form) {
    case "gate_cleared": {
      const cleared = a.week.gatesCleared.get(a.acceptance.gate);
      // A barrier belongs to a closed set and cannot leave a tracked set, so
      // a gate this week did not look at is this week's miss.
      if (cleared === undefined) return NOT_MEASURED;
      return decide(cleared, (m) => m.value);
    }
    case "issues_cleared": {
      // A page the week did not check, or a check that did not run, is this
      // week's miss — never a cause: the checks are a closed set.
      const cleared = pageFixesCleared(
        a.week.siteIssues,
        a.acceptance.issues,
        a.acceptance.pageUrl,
        a.week.measuredAt
      );
      if (cleared === null) return NOT_MEASURED;
      return decide(cleared, (m) => m.value);
    }
  }
}
