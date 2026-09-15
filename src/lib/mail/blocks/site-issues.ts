// SPEC §9 in mail — the technical-issue facts as fact rows, one projection
// for every mail that states them.
//
// A row is the check's own title (`SITE_CHECK_TITLE`, the map the report's
// cards and the Overview's "Needs you" read) and a value written the way the
// Overview writes the figure — count over the set it was counted over — with
// the severity word beside it, joined as the report mail joins a score and
// its band. One map and one figure, so the mail, the report and the
// dashboard cannot state one measurement two ways.
//
// A check that could not run gives no row: a mail has no room for its
// why-line, and a zero in its place would be "no issues found".
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { measured, type Measured } from "@/lib/measure/measured";
import type { IssueChange } from "@/lib/site-issues/changes";
import type { IssueSeverity, SiteIssuesSection } from "@/lib/site-issues/types";
import { formatStat } from "./format";
import type { FactRow } from "./types";

/** The stored count, through the mail's one numeral formatter. The date is
 *  never read by the `integer` form; the row states no date of its own. */
function count(value: number): string {
  return formatStat(measured(value, new Date(0)), "integer");
}

function figure(a: { count: number; over: number; severity: IssueSeverity }): string {
  return `${count(a.count)}/${count(a.over)} · ${copy(SITE_SEVERITY_WORD[a.severity])}`;
}

/** The faults a stored reading counted — every check that ran and counted
 *  at least one, in §9's order. A measured zero is "Nothing to fix" on the
 *  report's card; in a mail it is not a fault, and gives no row. */
export function issueRows(section: SiteIssuesSection | null): readonly FactRow[] {
  const rows: FactRow[] = [];
  for (const issue of section?.issues ?? []) {
    if (!issue.ran || issue.count === 0) continue;
    rows.push({ label: SITE_CHECK_TITLE[issue.check], value: figure(issue) });
  }
  return rows;
}

/** What moved since last Monday: last week's count, then this week's figure
 *  as the dashboard states it. An unmeasured change — either week without
 *  its checks — gives no rows, and `omit.ts` drops the empty block. */
export function issueChangeRows(changes: Measured<readonly IssueChange[]>): readonly FactRow[] {
  if (changes.kind === "unmeasured") return [];
  return changes.value.map((change) => ({
    label: SITE_CHECK_TITLE[change.check],
    value: `${count(change.from)} → ${figure({ count: change.to, over: change.over, severity: change.severity })}`,
  }));
}
