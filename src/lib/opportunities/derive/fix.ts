// BUILD §7 — the Fix family: an instruction, never a page.
//
// §7: "`unblock` — Any access gate fails — **instruction only, never
// generated, never automated**." That promise is a shape here, not a
// policy anyone has to enforce: an `unblock` is created with a null
// `targetQuery`, a null `fitBand` and a null `volume`, so it cannot be
// ranked (`rankOpen` excludes the Fix family), cannot fill a day
// (`nextForDay` reads the ranked head), cannot be counted as supply
// (`supplyDepth` excludes it), and carries no target search a generation
// pipeline could write against. A customer holding four outstanding
// instructions and no pages has zero days of pages, and is told so.
//
// Three of the five barriers are measured today:
//
//   robots_disallow    the robots policy disallows every reader.
//   blocked_ai_agent   the policy names an AI reader and disallows it —
//                      the same list the report's `blockedAgents` is
//                      derived from, read once and not recounted here.
//   noindex            the home document tells every reader not to index
//                      it.
//
// **A second shape, `fix_page`** (SPEC §9, #690). A crawled page failed a
// check ReachKit fixes itself — its title, its meta description, its
// structured data — and the fix is an update to that page, so unlike an
// `unblock` it publishes. It keeps the family's shape all the same: no
// search, no band, no slug. One per page, naming every such check the page
// failed, and never for a page the site's own hosted destination serves:
// those are ReachKit's own template, which a daily update is not the way to
// fix (owner ruling 2026-09-14).
//
// `login_wall` and `js_only` are members of the closed union and storable,
// and nothing produces them: the parser reads a fetched document and
// reports neither an auth redirect nor a body whose content arrives only
// after script execution (there is no headless browser — §6). A sixth
// barrier is a change to what the product measures, not a string a caller
// may pass.
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import type { StoredReport } from "@/lib/scan/report";
import { FAMILY_OF, noRejections, PAGE_FIXES, type Barrier, type PageFix } from "../types";
import { type Candidate, type DerivationResult } from "./candidate";

interface FixInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  /** The host the site's hosted destination serves at, whose pages get no
   *  `fix_page`. Absent or `null` where the site has none. */
  hostedHost?: string | null;
}

function unblockCandidate(a: FixInput, barrier: Barrier, foundOnUrl: string): Candidate {
  return {
    siteId: a.siteId,
    scanId: a.scanId,
    type: "unblock",
    family: FAMILY_OF.unblock,
    targetQuery: null,
    targetRef: foundOnUrl,
    title: null,
    volume: null,
    evidence: { family: "fix", barrier, foundOnUrl },
    acceptance: { form: "gate_cleared", gate: barrier },
    fitBand: null,
    // Written so the column's `not null` holds and the row is well-formed.
    // Nothing reads it: `rankScore` returns 0 for an `unblock` before it
    // ever reaches an effort term, and the Fix family is excluded from the
    // ranked set upstream of that.
    effort: EFFORT_BY_TYPE.answerable_page,
  };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** The pages that failed a check ReachKit fixes, each with the checks it
 *  failed, in crawl order. Read from the addresses the scan recorded and
 *  from nothing else: a report that kept none yields none. */
export function pageFixesOf(report: StoredReport): ReadonlyMap<string, readonly PageFix[]> {
  const byPage = new Map<string, PageFix[]>();
  const section = report.siteIssues;
  if (section === null) return byPage;
  for (const check of PAGE_FIXES) {
    const issue = section.issues.find((i) => i.check === check);
    if (issue === undefined || !issue.ran || issue.pages === null) continue;
    for (const url of issue.pages) {
      const list = byPage.get(url) ?? [];
      list.push(check);
      byPage.set(url, list);
    }
  }
  return byPage;
}

function fixPageCandidate(a: FixInput, pageUrl: string, issues: readonly PageFix[]): Candidate {
  return {
    siteId: a.siteId,
    scanId: a.scanId,
    type: "fix_page",
    family: FAMILY_OF.fix_page,
    targetQuery: null,
    targetRef: pageUrl,
    title: null,
    volume: null,
    evidence: { family: "fix", issues, pageUrl },
    acceptance: { form: "issues_cleared", issues, pageUrl },
    fitBand: null,
    // Written so the column's `not null` holds; nothing reads it — a
    // `fix_page` is placed by `rank/open.ts`'s rule, never scored.
    effort: EFFORT_BY_TYPE.answerable_page,
  };
}

export function fixCandidates(a: FixInput): DerivationResult {
  const { report } = a;
  const result: DerivationResult = { candidates: [], assessed: 0, rejected: noRejections() };

  const origin = report.robots.kind === "unmeasured" ? null : report.robots.value.origin;
  const pageUrl = report.onPage.kind === "unmeasured" ? null : report.onPage.value.url;

  if (report.robots.kind !== "unmeasured" && origin !== null) {
    const policy = report.robots.value;
    result.assessed += 1;
    if (policy.disallowsAll) {
      result.candidates.push(unblockCandidate(a, "robots_disallow", origin));
    } else if (report.blockedAgents.length > 0) {
      result.candidates.push(unblockCandidate(a, "blocked_ai_agent", origin));
    }
  }

  if (report.onPage.kind !== "unmeasured" && pageUrl !== null) {
    const facts = report.onPage.value;
    result.assessed += 1;
    if (facts.noindex && facts.noindexAppliesToEveryReader) {
      result.candidates.push(unblockCandidate(a, "noindex", pageUrl));
    }
  }

  const hosted = a.hostedHost?.toLowerCase() ?? null;
  for (const [pageUrl, issues] of pageFixesOf(report)) {
    result.assessed += 1;
    if (hosted !== null && hostOf(pageUrl) === hosted) continue;
    result.candidates.push(fixPageCandidate(a, pageUrl, issues));
  }

  return result;
}
