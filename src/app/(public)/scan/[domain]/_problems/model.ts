// BUILD §4.1 module 3 — three counts become three problem cards
//
// One severity that follows its own count and nothing else, and one `Fix`
// arm that cannot hold lines a founder should not paste. No JSX, no string
// a person reads, no React import: the rendering is `cards.tsx`'s and this
// file is what it renders.
//
// The severity boundaries are `SEVERITY_THRESHOLDS`
// (`src/lib/config/constants.ts`) — never restated here — so severity is a
// step function of exactly one number, reading no denominator, tier,
// market or date. That is what makes "the larger count never carries the
// lower severity" a property of the code rather than a convention.
import { SEVERITY_THRESHOLDS } from "@/lib/config/constants";
import { combine, mapMeasured, measured, measuredZero, NOT_BUILT, type Measured } from "@/lib/measure/measured";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { rankedFreePages } from "@/lib/opportunities/free-page";
import type { CopyKey } from "@/lib/presentation/copy";
import type { StoredReport } from "@/lib/scan/report";

/** Exactly three, closed. "Three problems" is the union, not a length
 *  check on an array somebody can push to. */
export type ProblemName = "blocked_readers" | "missing_pages" | "unquotable_pages";

/** Ordered, internal. The three words are `BANDS_COPY`'s `severity.*` and
 *  are the owner's; no word appears in this file. */
export type Severity = "low" | "mid" | "high";

/** `SEVERITY` (`src/lib/presentation/bands.ts`) is a `readonly [CopyKey,
 *  CopyKey, CopyKey]` **ascending in the count**, so it is indexed by
 *  ordinal and never keyed by the handle string. This map is the one
 *  place that ordering is written down. */
export const SEVERITY_INDEX: Readonly<Record<Severity, 0 | 1 | 2>> = Object.freeze({
  low: 0,
  mid: 1,
  high: 2,
});

/** The three cards' titles and the three "who does the work" lines, one
 *  key each. A problem with no title cannot render. */
const PROBLEM_COPY: Readonly<
  Record<ProblemName, { title: CopyKey; doer: CopyKey; noneNeeded: CopyKey }>
> = Object.freeze({
  blocked_readers: {
    title: "problem.blocked-readers.title",
    doer: "problem.blocked-readers.doer",
    noneNeeded: "problem.blocked-readers.none-needed",
  },
  missing_pages: {
    title: "problem.missing-pages.title",
    doer: "problem.missing-pages.doer",
    noneNeeded: "problem.missing-pages.none-needed",
  },
  unquotable_pages: {
    title: "problem.unquotable-pages.title",
    doer: "problem.unquotable-pages.doer",
    noneNeeded: "problem.unquotable-pages.none-needed",
  },
});

/** The order the cards render in, fixed here and read by `cardsOf` and by
 *  `MethodSections` alike, so a method section can never go missing for a
 *  problem that has a card. */
export const PROBLEM_ORDER: readonly [ProblemName, ProblemName, ProblemName] = Object.freeze([
  "blocked_readers",
  "missing_pages",
  "unquotable_pages",
]);

/** Lines exist on exactly one arm, so a card can neither show a founder
 *  lines they should not paste nor omit them when they are needed. */
export type Fix =
  | { kind: "none_needed" } // a measured zero
  | { kind: "unknown" } // unmeasured, either reason
  | { kind: "paste"; lines: readonly string[] } // blocked_readers, measured > 0
  | { kind: "we_write" } // missing_pages
  | { kind: "we_rewrite" }; // unquotable_pages

/** There is no field here that could hold a page, a title or a URL, so
 *  "neither lists nor previews the pages themselves" is unrepresentable
 *  rather than reviewed. */
export interface ProblemCard {
  problem: ProblemName;
  count: Measured<number>;
  severity: Measured<Severity>;
  title: CopyKey;
  doer: CopyKey;
  /** The line a card shows when its count is a measured zero. */
  noneNeeded: CopyKey;
  fix: Fix;
}

/** The trichotomy is carried, not re-decided: where a problem could not be
 *  measured, its count and its severity both read as the dash, with the
 *  same reason. A measured zero is `low`, never unmeasured. */
export function severityOf(p: ProblemName, count: Measured<number>): Measured<Severity> {
  const bounds = SEVERITY_THRESHOLDS[p];
  return mapMeasured(count, (n) => (n >= bounds.high ? "high" : n >= bounds.mid ? "mid" : "low"));
}

function fixFor(problem: ProblemName, count: Measured<number>, blockedAgents: readonly string[]): Fix {
  if (count.kind === "unmeasured") return { kind: "unknown" };
  if (count.kind === "zero") return { kind: "none_needed" };
  switch (problem) {
    case "blocked_readers":
      return { kind: "paste", lines: blockedAgents };
    case "missing_pages":
      return { kind: "we_write" };
    case "unquotable_pages":
      return { kind: "we_rewrite" };
    default: {
      const exhaustive: never = problem;
      return exhaustive;
    }
  }
}

/** SPEC §9 (2026-09-29, D14): the blocked-readers card states the check's
 *  own count — answer readers the access rules block, plus pages a snippet
 *  control hides — and those pages. A report whose check did not run falls
 *  back to the verdict's count of readers. */
export function answerReadersOf(report: StoredReport): { count: Measured<number>; snippetPages: readonly string[] } {
  const issue = report.siteIssues?.issues.find((i) => i.check === "ai_readers_blocked");
  if (issue === undefined || !issue.ran) return { count: report.verdict.blockedReaders, snippetPages: [] };
  const at = report.verdict.measuredAt;
  return {
    count: issue.count === 0 ? measuredZero(0, at) : measured(issue.count, at),
    snippetPages: issue.pages ?? [],
  };
}

export interface MissingPage {
  search: string;
  volume: number | null;
  /** The competitor first in the search today, where one is. */
  holder: string | null;
  /** Every site on the search's first page, as the report stored it; `null`
   *  where that search was not read. */
  firstPage: readonly string[] | null;
}

/** Every page the report found missing, read from what it stored at 0¢: the
 *  pages "page 1 of N" counts. `null` where the report did not measure its
 *  questions or its market, so nothing can say what is missing. */
export function missingPagesOf(report: StoredReport): readonly MissingPage[] | null {
  if (report.questions.kind === "unmeasured" || report.market.kind === "unmeasured") return null;
  const questions = report.questions.value;
  return rankedFreePages(report).map((page) => {
    const serp = report.serps[questions.findIndex((q) => q.search.keyword === page.targetQuery)];
    return {
      search: page.targetQuery ?? "",
      volume: page.volume === null || page.volume.kind === "unmeasured" ? null : page.volume.value,
      holder: page.evidence.family === "write" ? page.evidence.rival.domain : null,
      firstPage:
        serp === undefined || serp.kind === "unmeasured"
          ? null
          : serp.value.organic.map((row) => registrableDomain(row.domain) ?? row.domain),
    };
  });
}

/** How many of the missing pages `domain` is on the first page for; `null`
 *  where no missing page's search was read, never 0. */
export function pagesHeldBy(pages: readonly MissingPage[] | null, domain: string): number | null {
  const read = (pages ?? []).filter((page) => page.firstPage !== null);
  if (read.length === 0) return null;
  const own = registrableDomain(domain) ?? domain;
  return read.filter((page) => page.firstPage!.includes(own)).length;
}

/** The missing-pages card's count: the supply section's where a scan built
 *  it, else the pages listed above it, unmeasured for the reason its
 *  questions or market were. */
function missingCountOf(report: StoredReport): Measured<number> {
  if (report.supply.missingPages.kind !== "unmeasured") return report.supply.missingPages;
  const pages = missingPagesOf(report);
  if (pages === null) return combine([report.questions, report.market], () => 0);
  const at = report.verdict.measuredAt;
  return pages.length === 0 ? measuredZero(0, at) : measured(pages.length, at);
}

/** No scan builds the supply section's counts yet, so an unmeasured one says
 *  not measured yet rather than that the scan stopped early. */
function notBuilt(count: Measured<number>): Measured<number> {
  return count.kind === "unmeasured" ? { ...count, because: NOT_BUILT } : count;
}

/** Reads the blocked-readers count from the check and the other two from
 *  the blob's supply section. Returns the three-tuple; the length is the
 *  type, not a runtime check. `unblockLines` is applied by the caller that
 *  knows which agents are blocked — this function performs no write and no
 *  outbound request, and imports no egress client. */
export function cardsOf(
  report: StoredReport,
  unblockLines: readonly string[]
): readonly [ProblemCard, ProblemCard, ProblemCard] {
  const counts: Readonly<Record<ProblemName, Measured<number>>> = {
    blocked_readers: answerReadersOf(report).count,
    missing_pages: missingCountOf(report),
    unquotable_pages: notBuilt(report.supply.unquotablePages),
  };

  const [a, b, c] = PROBLEM_ORDER.map((problem): ProblemCard => {
    const count = counts[problem];
    return {
      problem,
      count,
      severity: severityOf(problem, count),
      title: PROBLEM_COPY[problem].title,
      doer: PROBLEM_COPY[problem].doer,
      noneNeeded: PROBLEM_COPY[problem].noneNeeded,
      fix: fixFor(problem, count, unblockLines),
    };
  }) as [ProblemCard, ProblemCard, ProblemCard];

  return [a, b, c];
}
