// Technical issues, as board `AppIssues` lays it out: the lead with the
// scan's day, a summary of the pages read, then one card per problem the
// customer fixes. Rendered from one reading, so every arm can be drawn from
// a stored section without a session.
import type React from "react";
import Link from "next/link";
import { ArrowLeft, Check, Wrench } from "lucide-react";
import { SITE_ISSUES } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { SITE_CHECKS, type SiteCheck } from "@/lib/site-issues/types";
import type { IssuesReading, WaitingIssue } from "../_overview/alerts";
import { formatCount } from "../_overview/present";
import { SHELL_LOCALE } from "../_shell/format";

const OVERVIEW = "/app";

const SEVERITY_BADGE: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "badge badge-soft badge-error",
  worth_fixing: "badge badge-soft badge-warning",
};

const SEVERITY_FILL: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "bg-error",
  worth_fixing: "bg-warning",
};

const SEVERITY_PROGRESS: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "progress-error",
  worth_fixing: "progress-warning",
};

/** The summary's short name for each check that can name pages. */
const LEGEND: Readonly<Partial<Record<SiteCheck, CopyKey>>> = {
  noindex_pages: "overview.issues.legend.noindex-pages",
  slow_pages: "overview.issues.legend.slow-pages",
  broken_links: "overview.issues.legend.broken-links",
  phone_usability: "overview.issues.legend.phone-usability",
  ai_readers_blocked: "overview.issues.legend.ai-readers",
};

const ONE_PLACE = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function seconds(ms: number): string {
  return copy("overview.issues.seconds", { seconds: ONE_PLACE.format(ms / 1000) });
}

function scanDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(at);
}

/** Critical first, then SPEC §9's order. */
function byRank(a: WaitingIssue, b: WaitingIssue): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  return SITE_CHECKS.indexOf(a.check) - SITE_CHECKS.indexOf(b.check);
}

/** Each address counted once, under the first problem that names it, so the
 *  bar and its legend add up to the pages read. */
function shares(issues: readonly WaitingIssue[]): { issue: WaitingIssue; count: number }[] {
  const seen = new Set<string>();
  const out: { issue: WaitingIssue; count: number }[] = [];
  for (const issue of issues) {
    let count = 0;
    for (const page of issue.pages) {
      if (seen.has(page)) continue;
      seen.add(page);
      count++;
    }
    if (count > 0) out.push({ issue, count });
  }
  return out;
}

function affectedLine(pages: number, problems: number): string | null {
  if (pages === 0) return null;
  if (pages === 1) return copy("overview.issues.affected.one-page");
  if (problems === 1) return copy("overview.issues.affected.one-problem", { pages: formatCount(pages) });
  return copy("overview.issues.affected", { pages: formatCount(pages), problems: formatCount(problems) });
}

function Summary(p: { issues: readonly WaitingIssue[]; pagesChecked: number }): React.JSX.Element {
  const parts = shares(p.issues);
  const affected = parts.reduce((sum, part) => sum + part.count, 0);
  const fine = Math.max(0, p.pagesChecked - affected);
  const line = affectedLine(affected, parts.length);
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="issues-read" data-testid="issues-summary">
      <div className="card-body grid min-w-0 gap-5 p-5 md:grid-cols-2 md:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <p id="issues-read" className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            {copy("overview.issues.read", { count: formatCount(p.pagesChecked) })}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2" data-testid="issues-fine">
            <span className="num text-3xl font-semibold">{formatCount(fine)}</span>
            <span className="text-sm text-base-content/70">{copy("overview.issues.fine")}</span>
          </p>
          <p className="text-sm">
            {line === null ? null : `${line} `}
            {copy("overview.issues.ours")}
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex h-4 w-full gap-1">
            {parts.map((part) => (
              <span key={part.issue.check} className={`basis-0 rounded-sm ${SEVERITY_FILL[part.issue.severity]}`} style={{ flexGrow: part.count }} aria-hidden />
            ))}
            {fine === 0 ? null : <span className="basis-0 rounded-sm bg-success/30" style={{ flexGrow: fine }} aria-hidden />}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs" data-testid="issues-legend">
            {parts.map((part) => {
              const key = LEGEND[part.issue.check];
              return key === undefined ? null : (
                <span key={part.issue.check} className="inline-flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-sm ${SEVERITY_FILL[part.issue.severity]}`} aria-hidden />
                  {copy(key, { count: formatCount(part.count) })}
                </span>
              );
            })}
            {fine === 0 ? null : (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-success/30" aria-hidden />
                {copy("overview.issues.legend.fine", { count: formatCount(fine) })}
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function IssueCard(p: { issue: WaitingIssue; pagesChecked: number }): React.JSX.Element {
  const { issue } = p;
  const named = issue.pages.length;
  return (
    <section id={issue.check} className="card card-border min-w-0 scroll-mt-24 bg-base-100" data-testid="issue" data-check={issue.check}>
      <div className="card-body min-w-0 gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="card-title min-w-0 flex-1 text-base">{copy(SITE_CHECK_TITLE[issue.check])}</h2>
          <span className={SEVERITY_BADGE[issue.severity]}>{copy(SITE_SEVERITY_WORD[issue.severity])}</span>
        </div>
        {named === 0 ? (
          <p className="text-sm text-base-content/70">{copy("overview.issues.site")}</p>
        ) : (
          <p className="flex min-w-0 items-center gap-3 text-sm">
            <progress
              className={`progress w-48 max-w-1/2 ${SEVERITY_PROGRESS[issue.severity]}`}
              value={named}
              max={p.pagesChecked}
              aria-hidden
            />
            <span className="num">{copy("overview.issues.share", { count: formatCount(named), over: formatCount(p.pagesChecked) })}</span>
          </p>
        )}
        <div className="flex min-w-0 gap-2 rounded-box bg-base-200 p-3 text-sm">
          <Wrench size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <p data-testid="issue-fix">
              <strong>{copy("overview.issues.fix")}</strong> {copy(issue.fix)}
            </p>
            <p className="text-base-content/70">{copy("overview.issues.who")}</p>
          </div>
        </div>
        {named === 0 ? null : (
          <details className="collapse collapse-arrow min-w-0">
            <summary className="collapse-title px-0 text-sm font-semibold">
              {named === 1 ? copy("overview.issues.show.one") : copy("overview.issues.show", { count: formatCount(named) })}
            </summary>
            <div className="collapse-content min-w-0 px-0">
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
              {issue.ms === undefined ? null : (
                <p className="text-xs text-base-content/70">
                  {copy("overview.issues.slow-note", { seconds: formatCount(SITE_ISSUES.SLOW_PAGE_MS / 1000) })}
                </p>
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** The screen for one reading: `null` where the stored report could not be read. */
export function IssuesView(p: { reading: IssuesReading | null; timeZone: string }): React.JSX.Element {
  const { reading } = p;
  const found =
    reading?.measuredAt == null ? null : copy("overview.issues.found", { date: scanDay(reading.measuredAt, p.timeZone) });
  const issues = reading === null ? [] : [...reading.issues].sort(byRank);
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="issues">
      <header className="flex min-w-0 flex-col gap-1">
        <Link href={OVERVIEW} className="link link-hover inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("chrome.back-to-overview")}
        </Link>
        <h1 className="text-2xl font-semibold">{copy("overview.issues.title")}</h1>
        <p className="text-sm text-base-content/70" data-testid="issues-lead">
          {copy("overview.issues.lead")}
          {found === null ? null : ` ${found}`}
        </p>
      </header>
      {reading === null ? (
        <div role="alert" className="alert alert-soft alert-warning">
          {copy("overview.issues.unreadable")}
        </div>
      ) : reading.measuredAt === null ? (
        <p className="text-sm" data-testid="issues-unscanned">
          {copy("overview.issues.unscanned")}
        </p>
      ) : issues.length === 0 ? (
        <div className="flex min-w-0 flex-col items-center gap-3 py-4 text-center" data-testid="issues-empty">
          <span className="grid size-10 place-items-center rounded-full bg-success/10 text-success">
            <Check size={20} strokeWidth={2} aria-hidden />
          </span>
          <p className="font-semibold">{copy("overview.issues.empty")}</p>
        </div>
      ) : (
        <>
          {reading.pagesChecked === null ? null : <Summary issues={issues} pagesChecked={reading.pagesChecked} />}
          <div className="flex min-w-0 flex-col gap-4">
            {issues.map((issue) => (
              <IssueCard key={issue.check} issue={issue} pagesChecked={reading.pagesChecked ?? issue.over} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
