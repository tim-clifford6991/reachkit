// SPEC *Site fixes and Costs* — everything Site Fixes shows, from one reading: the lead, the pages read and how they
// split, one row per fix and each fix's detail. The view draws only from this, so no two of its numbers can disagree.
import { SITE_ISSUES } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import { SITE_CHECK_TITLE, SITE_SEVERITY_WORD } from "@/lib/presentation/site-issues";
import { SITE_CHECKS, type SiteCheck } from "@/lib/site-issues/types";
import type { IssuesReading, WaitingIssue } from "../_overview/alerts";
import { formatCount } from "../_overview/present";
import { SHELL_LOCALE } from "../_shell/format";

export type FixTone = WaitingIssue["severity"] | "not_run";

export interface FixPage {
  url: string;
  /** The address as the board writes it: no scheme. */
  address: string;
  /** Slow pages only. */
  seconds: string | null;
}

export interface FixRow {
  id: SiteCheck;
  name: string;
  tone: FixTone;
  badge: string;
  /** "{n} of {total} pages", the whole-site line, or `null` for a check that could not run. */
  share: string | null;
  /** The pages the row names; 0 for a fault of the whole site or a check not run. */
  named: number;
  /** The one sentence that says what to do, or why nothing is known. */
  fix: string;
  /** "The {n} Pages", or `null` where no page is named. */
  heading: string | null;
  pages: readonly FixPage[];
  note: string | null;
}

export interface SiteFixesScreen {
  lead: string;
  state: "unreadable" | "unscanned" | "empty" | "fixes";
  /** The state's one line, where it has one. */
  line: string | null;
  /** "Your site, {n} pages read", and how they split where the split is measured; `null` before a check. */
  summary: { read: string; split: { fine: number; fineLabel: string; problem: number; problemLine: string | null; ours: string } | null } | null;
  rows: readonly FixRow[];
  words: { back: string; fixLabel: string; newTab: string; list: string };
}

const ONE_PLACE = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function scanDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone, weekday: "long", day: "numeric", month: "long" }).format(at);
}

function rowOf(issue: WaitingIssue, total: number): FixRow {
  const named = issue.pages.length;
  return {
    id: issue.check,
    name: copy(SITE_CHECK_TITLE[issue.check]),
    tone: issue.severity,
    badge: copy(SITE_SEVERITY_WORD[issue.severity]),
    share: named === 0 ? copy("overview.issues.site") : copy("overview.issues.share", { count: formatCount(named), over: formatCount(total) }),
    named,
    fix: copy(issue.fix),
    heading: named === 0 ? null : named === 1 ? copy("overview.issues.pages.one") : copy("overview.issues.pages", { count: formatCount(named) }),
    pages: issue.pages.map((url, i) => ({
      url,
      address: url.replace(/^https?:\/\//, ""),
      seconds: issue.ms?.[i] === undefined ? null : copy("overview.issues.seconds", { seconds: ONE_PLACE.format(issue.ms[i] / 1000) }),
    })),
    note: issue.ms === undefined ? null : copy("overview.issues.slow-note", { seconds: formatCount(SITE_ISSUES.SLOW_PAGE_MS / 1000) }),
  };
}

function notRunRow(check: SiteCheck): FixRow {
  return { id: check, name: copy(SITE_CHECK_TITLE[check]), tone: "not_run", badge: copy("check.status.not-run"), share: null, named: 0, fix: copy("check.not-run"), heading: null, pages: [], note: null };
}

/** Critical first, then the most pages, then SPEC §9's order; a check that could not run last. */
function byRank(a: FixRow, b: FixRow): number {
  const rank = (row: FixRow) => (row.tone === "critical" ? 0 : row.tone === "worth_fixing" ? 1 : 2);
  return rank(a) - rank(b) || b.named - a.named || SITE_CHECKS.indexOf(a.id) - SITE_CHECKS.indexOf(b.id);
}

/** The screen for one reading: `null` where the stored report could not be read. */
export function siteFixesScreen(reading: IssuesReading | null, timeZone: string): SiteFixesScreen {
  const words = { back: copy("overview.issues.back"), fixLabel: copy("overview.issues.fix"), newTab: copy("draft.live.new-tab"), list: copy("overview.issues.title") };
  const date = reading?.measuredAt == null ? null : scanDay(reading.measuredAt, timeZone);
  const lead = date === null ? copy("overview.issues.lead") : `${copy("overview.issues.lead")} ${copy("overview.issues.found", { date })}`;
  if (reading === null) return { lead, state: "unreadable", line: copy("overview.issues.unreadable"), summary: null, rows: [], words };
  if (date === null || reading.pagesChecked === null) return { lead, state: "unscanned", line: copy("overview.issues.unscanned"), summary: null, rows: [], words };

  const read = reading.pagesChecked;
  const rows = [...reading.issues.map((issue) => rowOf(issue, read)), ...reading.notRun.map(notRunRow)].sort(byRank);
  // A page two fixes name is one page, and only a page that was read is counted.
  const checked = reading.splittable === null ? null : new Set(reading.splittable);
  const problem = checked === null ? null : new Set(reading.issues.flatMap((issue) => issue.pages).filter((page) => checked.has(page))).size;
  const split =
    problem === null
      ? null
      : {
          fine: read - problem,
          fineLabel: copy("overview.issues.fine"),
          problem,
          problemLine: problem === 0 ? null : problem === 1 ? copy("overview.issues.affected.one-page") : copy("overview.issues.affected", { pages: formatCount(problem) }),
          ours: copy("overview.issues.ours"),
        };
  const summary = { read: copy("overview.issues.read", { count: formatCount(read) }), split };
  if (rows.length > 0) return { lead, state: "fixes", line: null, summary, rows, words };
  // With no row, every check of the customer's ran: nothing to fix, unless a count kept no list of its pages.
  return { lead, state: "empty", line: reading.unnamed ? copy("overview.issues.unnamed") : copy("overview.issues.empty", { count: formatCount(read), date }), summary, rows, words };
}
