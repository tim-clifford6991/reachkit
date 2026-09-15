// SPEC §9 "Re-checked every Monday" — what changed between two stored
// readings of the nine checks.
//
// Pure. The two sections are the ones already stored on the two weeks'
// reports; nothing is re-checked. A change needs both readings, so where
// either week carries no section the answer is `unmeasured` — never an
// empty list, which would say "measured, and nothing changed".
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import type { IssueSeverity, IssueUnit, SiteCheck, SiteIssuesSection } from "./types";

/** One check whose count moved: fixed (to 0), appeared (from 0), or
 *  grown/shrunk. `over` and `severity` are this week's, as the report and the
 *  dashboard state them for the same measurement. */
export interface IssueChange {
  check: SiteCheck;
  from: number;
  to: number;
  over: number;
  unit: IssueUnit;
  severity: IssueSeverity;
}

/** The checks that ran in both weeks and counted differently, in
 *  `SITE_CHECKS` order (the order the sections are stored in). A check that
 *  could not run in either week has no change to state. */
export function issueChanges(
  now: SiteIssuesSection | null,
  before: SiteIssuesSection | null,
  at: Date
): Measured<readonly IssueChange[]> {
  if (now === null || before === null) return unmeasured("not_attempted", at);
  const out: IssueChange[] = [];
  for (const issue of now.issues) {
    if (!issue.ran) continue;
    const prior = before.issues.find((b) => b.check === issue.check);
    if (prior === undefined || !prior.ran || prior.count === issue.count) continue;
    out.push({
      check: issue.check,
      from: prior.count,
      to: issue.count,
      over: issue.over,
      unit: issue.unit,
      severity: issue.severity,
    });
  }
  return measured(out, at);
}
