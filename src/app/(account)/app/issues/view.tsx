// Technical issues, as board `AppIssues` lays it out: the lead with the
// scan's day and who can fix them, a summary of the pages read, then one card
// per problem the customer fixes. Rendered from one reading, so every arm can be drawn from
// a stored section without a session.
import type React from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ExternalLink, SignalHigh, SignalMedium, Wrench, type LucideIcon } from "lucide-react";
import { SITE_ISSUES } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_ICON, SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { SITE_CHECKS } from "@/lib/site-issues/types";
import type { IssuesReading, WaitingIssue } from "../_overview/alerts";
import { formatCount } from "../_overview/present";
import { SHELL_LOCALE } from "../_shell/format";

const OVERVIEW = "/app";

// The board draws critical in the warning tone and the rest quiet: a site fix is optional, never an alarm.
const SEVERITY_BADGE: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "badge badge-soft badge-warning",
  worth_fixing: "badge border-0 bg-base-200 text-base-content/70",
};

const SEVERITY_SIGNAL: Readonly<Record<WaitingIssue["severity"], LucideIcon>> = {
  critical: SignalHigh,
  worth_fixing: SignalMedium,
};

const SEVERITY_TILE: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "bg-(--warn-bg) text-warning",
  worth_fixing: "bg-base-200 text-base-content/70",
};

const SEVERITY_ACCENT: Readonly<Record<WaitingIssue["severity"], string>> = {
  critical: "border-l-4 border-l-(--warn-rule)",
  worth_fixing: "",
};

const ONE_PLACE = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function seconds(ms: number): string {
  return copy("overview.issues.seconds", { seconds: ONE_PLACE.format(ms / 1000) });
}

/** An address as the board writes it: no scheme. */
function bare(page: string): string {
  return page.replace(/^https?:\/\//, "");
}

function scanDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(at);
}

/** Critical first, then SPEC §9's order. */
function byRank(a: WaitingIssue, b: WaitingIssue): number {
  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
  return SITE_CHECKS.indexOf(a.check) - SITE_CHECKS.indexOf(b.check);
}

function affectedLine(pages: number): string | null {
  if (pages === 0) return null;
  if (pages === 1) return copy("overview.issues.affected.one-page");
  return copy("overview.issues.affected", { pages: formatCount(pages) });
}

function Summary(p: { issues: readonly WaitingIssue[]; pagesChecked: number }): React.JSX.Element {
  // Each address counted once, so a page two problems name is one page.
  const affected = new Set(p.issues.flatMap((issue) => issue.pages)).size;
  const line = affectedLine(affected);
  return (
    <section className="card card-border min-w-0 bg-base-100" aria-labelledby="issues-read" data-testid="issues-summary">
      <div className="card-body min-w-0 gap-1.5 p-5 max-sm:px-4">
        <p id="issues-read" className="eyebrow">
          {copy("overview.issues.read", { count: formatCount(p.pagesChecked) })}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2.5" data-testid="issues-fine">
          <span className="figure text-4xl leading-none">{formatCount(Math.max(0, p.pagesChecked - affected))}</span>
          <span className="text-sm text-base-content/70">{copy("overview.issues.fine")}</span>
        </p>
        <p className="text-sm">
          {line === null ? null : `${line} `}
          {copy("overview.issues.ours")}
        </p>
      </div>
    </section>
  );
}

function IssueCard(p: { issue: WaitingIssue; pagesChecked: number }): React.JSX.Element {
  const { issue } = p;
  const named = issue.pages.length;
  const Icon = SITE_CHECK_ICON[issue.check];
  const Signal = SEVERITY_SIGNAL[issue.severity];
  return (
    <section id={issue.check} className={`card card-border min-w-0 scroll-mt-24 bg-base-100 ${SEVERITY_ACCENT[issue.severity]}`} data-testid="issue" data-check={issue.check}>
      <div className="card-body min-w-0 gap-3.5 p-5 max-sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span aria-hidden className={`rounded-field grid size-9 shrink-0 place-items-center ${SEVERITY_TILE[issue.severity]}`} data-testid="issue-tile">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <h2 className="card-title min-w-0 flex-1 basis-50 text-base">{copy(SITE_CHECK_TITLE[issue.check])}</h2>
          <span className={SEVERITY_BADGE[issue.severity]} data-testid="issue-severity">
            <Signal className="size-4 shrink-0" strokeWidth={2.75} aria-hidden data-testid="issue-signal" />
            {copy(SITE_SEVERITY_WORD[issue.severity])}
          </span>
        </div>
        {named === 0 ? (
          <p className="text-sm text-base-content/70">{copy("overview.issues.site")}</p>
        ) : (
          <p className="text-sm" data-testid="issue-share">
            <strong>{copy("overview.issues.share", { count: formatCount(named), over: formatCount(p.pagesChecked) })}</strong> {copy("overview.issues.share.unit")}
          </p>
        )}
        <div className="flex min-w-0 gap-2 rounded-box bg-base-200 p-3 text-sm">
          <Wrench size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0" data-testid="issue-fix">
            <strong>{copy("overview.issues.fix")}</strong> {copy(issue.fix)}
          </p>
        </div>
        {named === 0 ? null : (
          <details className="collapse group min-w-0 rounded-none">
            <summary className="collapse-title link link-primary flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 p-0 text-sm font-semibold no-underline [&::-webkit-details-marker]:hidden">
              <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              {named === 1 ? copy("overview.issues.show.one") : copy("overview.issues.show", { count: formatCount(named) })}
            </summary>
            <div className="collapse-content min-w-0 p-0">
              <ul className="list min-w-0">
                {issue.pages.map((page, i) => (
                  <li key={page} className="list-row min-w-0 items-baseline px-0 py-2">
                    <a className="link link-primary link-hover list-col-grow min-w-0 font-mono text-sm break-all" href={page} rel="noopener noreferrer" target="_blank">
                      {bare(page)}
                      <ExternalLink className="ms-1 inline size-3.5 align-[-0.125em]" strokeWidth={1.75} aria-hidden />
                      <span className="sr-only"> {copy("draft.live.new-tab")}</span>
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
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link href={OVERVIEW} className="link link-primary link-hover inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold no-underline">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
          {copy("chrome.back-to-overview")}
        </Link>
        <h1>{copy("overview.issues.title")}</h1>
        <p className="min-w-0 text-base-content/70" data-testid="issues-lead">
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
