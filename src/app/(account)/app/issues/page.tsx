// Issue 1550 — Technical issues, at `/app/issues`.
//
// The account's own view of the checks the customer fixes (SPEC §9's "Free
// fix · 10 min"): each one names what it applies to and says what to do in
// one sentence. A needs-you item on Overview opens it at its check; it is
// never the public report, which is a sales page with a checkout on it.
// Read from the stored report, nothing re-checked. Not in the navigation.
// It declares no `Surface`: the shell's layout owns this route's screen root
// (`../layout.tsx`).
import type React from "react";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SITE_ISSUES } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { SITE_CHECKS } from "@/lib/site-issues/types";
import type { WaitingIssue } from "../_overview/alerts";
import { formatCount } from "../_overview/present";
import { readIssues } from "./provider";

export const metadata: Metadata = { title: copy("meta.app.issues.title") };

const SEVERITY_BADGE: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "badge badge-soft badge-error",
  worth_fixing: "badge badge-soft badge-warning",
};

const ONE_PLACE = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function seconds(ms: number): string {
  return copy("overview.issues.seconds", { seconds: ONE_PLACE.format(ms / 1000) });
}

/** Critical first, then SPEC §9's order. */
function byRank(a: WaitingIssue, b: WaitingIssue): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  return SITE_CHECKS.indexOf(a.check) - SITE_CHECKS.indexOf(b.check);
}

function IssueCard(p: { issue: WaitingIssue }): React.JSX.Element {
  const { issue } = p;
  return (
    <section id={issue.check} className="card card-border min-w-0 scroll-mt-24 bg-base-100" data-testid="issue" data-check={issue.check}>
      <div className="card-body min-w-0 gap-3 p-4">
        <h2 className="card-title flex-wrap text-base">
          {copy(SITE_CHECK_TITLE[issue.check])}
          <span className="badge badge-ghost num">{`${formatCount(issue.count)}/${formatCount(issue.over)}`}</span>
          <span className={SEVERITY_BADGE[issue.severity]}>{copy(SITE_SEVERITY_WORD[issue.severity])}</span>
        </h2>
        <p className="text-sm" data-testid="issue-fix">
          {copy(issue.fix)}
        </p>
        {issue.pages.length === 0 ? (
          <p className="text-sm text-base-content/70">{copy("overview.issues.site")}</p>
        ) : (
          <ul className="list min-w-0">
            {issue.pages.map((page, i) => (
              <li key={page} className="list-row min-w-0 items-baseline px-0 py-2">
                <a className="link list-col-grow min-w-0 font-mono text-sm break-all" href={page} rel="noopener noreferrer" target="_blank">
                  {page}
                </a>
                {issue.ms?.[i] === undefined ? null : <span className="text-sm tabular-nums">{seconds(issue.ms[i])}</span>}
              </li>
            ))}
          </ul>
        )}
        {issue.ms === undefined ? null : (
          <p className="text-xs text-base-content/70">
            {copy("overview.issues.slow-note", { seconds: formatCount(SITE_ISSUES.SLOW_PAGE_MS / 1000) })}
          </p>
        )}
      </div>
    </section>
  );
}

export default async function IssuesPage(): Promise<React.JSX.Element> {
  const issues = await readIssues();
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="issues">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-semibold">{copy("overview.issues.title")}</h1>
        <p className="text-sm text-base-content/70">{copy("overview.issues.lead")}</p>
      </header>
      {issues === null ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("overview.issues.unreadable")}
        </div>
      ) : issues.length === 0 ? (
        <div className="flex min-w-0 flex-col items-center gap-3 py-4 text-center" data-testid="issues-empty">
          <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
            <Check size={20} strokeWidth={2} aria-hidden />
          </span>
          <p className="font-semibold">{copy("overview.issues.empty")}</p>
        </div>
      ) : (
        [...issues].sort(byRank).map((issue) => <IssueCard key={issue.check} issue={issue} />)
      )}
    </div>
  );
}
