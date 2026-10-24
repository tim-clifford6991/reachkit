// SPEC §9 in mail — technical-issue facts as fact rows, through the report's titles and the Overview's figure, so no surface states one reading two ways.
// A check that could not run gives no row: a mail has no room for its why-line, and a zero would read "no issues found".
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_DOER, SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { measured, type Measured } from "@/lib/measure/measured";
import type { IssueChange } from "@/lib/site-issues/changes";
import { DOER_OF, type IssueSeverity, type SiteCheck, type SiteIssuesSection } from "@/lib/site-issues/types";
import { formatStat } from "./format";
import type { FactRow } from "./types";

/** The stored count, through the mail's one numeral formatter. The date is
 *  never read by the `integer` form; the row states no date of its own. */
function count(value: number): string {
  return formatStat(measured(value, new Date(0)), "integer");
}

function figure(a: { check: SiteCheck; count: number; over: number; severity: IssueSeverity }): string {
  const doer = DOER_OF[a.check];
  // "Free fix · 10 min" stays on the report's card: a row with no doer word is the customer's.
  const by = doer === "free_fix" ? "" : ` · ${copy(SITE_CHECK_DOER[doer])}`;
  return `${count(a.count)}/${count(a.over)} · ${copy(SITE_SEVERITY_WORD[a.severity])}${by}`;
}

/** Every check that ran and counted at least one, in §9's order; a measured zero is not a fault and gives no row. */
export function issueRows(section: SiteIssuesSection | null): readonly FactRow[] {
  const rows: FactRow[] = [];
  for (const issue of section?.issues ?? []) {
    if (!issue.ran || issue.count === 0) continue;
    rows.push({ label: SITE_CHECK_TITLE[issue.check], value: figure(issue) });
  }
  return rows;
}

/** Last week's count, then this week's figure. An unmeasured change gives no rows, and `omit.ts` drops the empty block. */
export function issueChangeRows(changes: Measured<readonly IssueChange[]>): readonly FactRow[] {
  if (changes.kind === "unmeasured") return [];
  return changes.value.map((change) => ({
    label: SITE_CHECK_TITLE[change.check],
    value: `${count(change.from)} → ${figure({ check: change.check, count: change.to, over: change.over, severity: change.severity })}`,
  }));
}
