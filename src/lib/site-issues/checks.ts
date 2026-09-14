// SPEC §9 — the nine technical-issue checks, over what the crawl read.
//
// Pure and total: no fetch, no clock, no store. The input is the site
// profile's one crawl (nothing beyond its set is read) and the access rules
// the measurement already parsed; the output is always nine issues in
// `SITE_CHECKS` order, each either a count with the set it was measured over
// or a reason it could not run.
//
// Severity, owner ruling 2026-09-14: a zero is "Nothing to fix"; a site-wide
// fault is "Critical" whenever present; a per-page count is "Worth fixing"
// from one and "Critical" at `SITE_ISSUES.CRITICAL_PAGE_SHARE` of its set.
import { AI_READER_AGENTS, SITE_ISSUES } from "@/lib/config/constants";
import type { Measured } from "@/lib/measure/measured";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { PageIssueFacts } from "./facts";
import {
  DOER_OF,
  SITE_CHECKS,
  type CouldNotRun,
  type IssueSeverity,
  type IssueUnit,
  type SiteCheck,
  type SiteIssue,
  type SiteIssuesSection,
} from "./types";

/** One crawled page, as the checks need it. `links` are the in-scope pages
 *  it links to, as crawl identities; `fetchMs` is how long the crawl's own
 *  fetch took, `null` where the document came from the cache. */
export interface CheckedPage {
  key: string;
  title: string;
  facts: PageIssueFacts;
  links: readonly string[];
  fetchMs: number | null;
}

export interface CrawlReading {
  /** Row one is the home page. */
  pages: readonly CheckedPage[];
  /** In-scope addresses the crawl fetched that answered with an HTTP error,
   *  by crawl identity. */
  brokenKeys: ReadonlySet<string>;
  /** Every in-scope address the crawl fetched, read or broken. */
  fetchedKeys: ReadonlySet<string>;
  sitemap: "found" | "absent" | "unreadable";
  stoppedBy: "complete" | "page_cap" | "time_budget";
}

type Blocked = readonly string[];

/** The crawl's own outcome, as the checks read it. Structural, so this module
 *  does not import the crawl that imports its facts reader. */
export function readingOf(crawl: {
  pages: readonly { url: string; title: string; facts: PageIssueFacts; links: readonly string[]; fetchMs: number | null }[];
  fetched: readonly string[];
  broken: readonly string[];
  sitemap: CrawlReading["sitemap"];
  stoppedBy: CrawlReading["stoppedBy"];
}): CrawlReading {
  return {
    pages: crawl.pages.map((page) => ({
      key: page.url,
      title: page.title,
      facts: page.facts,
      links: page.links,
      fetchMs: page.fetchMs,
    })),
    fetchedKeys: new Set(crawl.fetched),
    brokenKeys: new Set(crawl.broken),
    sitemap: crawl.sitemap,
    stoppedBy: crawl.stoppedBy,
  };
}

function couldNot(check: SiteCheck, because: CouldNotRun): SiteIssue {
  return { check, ran: false, because };
}

function perPage(
  check: SiteCheck,
  count: number,
  over: number,
  unit: IssueUnit = "pages",
  parts?: { missing: number; duplicate: number }
): SiteIssue {
  const severity: IssueSeverity =
    count === 0
      ? "nothing_to_fix"
      : over > 0 && count / over >= SITE_ISSUES.CRITICAL_PAGE_SHARE
        ? "critical"
        : "worth_fixing";
  return { check, ran: true, count, over, unit, severity, doer: DOER_OF[check], ...(parts ? { parts } : {}) };
}

function siteWide(check: SiteCheck, count: number, over: number, unit: IssueUnit): SiteIssue {
  return {
    check,
    ran: true,
    count,
    over,
    unit,
    severity: count === 0 ? "nothing_to_fix" : "critical",
    doer: DOER_OF[check],
  };
}

/** Whitespace-collapsed and ASCII case-folded, so "Pricing " and "pricing"
 *  are one title. */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** Pages with the value missing, and pages sharing a non-empty value with
 *  another page. A page is counted once. */
function missingOrDuplicate(values: readonly string[]): { affected: number; missing: number; duplicate: number } {
  const seen = new Map<string, number>();
  for (const value of values) {
    const key = normalise(value);
    if (key !== "") seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  let missing = 0;
  let duplicate = 0;
  for (const value of values) {
    const key = normalise(value);
    if (key === "") missing++;
    else if ((seen.get(key) ?? 0) > 1) duplicate++;
  }
  return { affected: missing + duplicate, missing, duplicate };
}

function aiReaders(robots: Measured<RobotsPolicy>, blocked: Blocked): SiteIssue {
  if (robots.kind === "unmeasured") return couldNot("ai_readers_blocked", "access_rules_unreadable");
  return siteWide("ai_readers_blocked", blocked.length, AI_READER_AGENTS.length, "ai_readers");
}

/**
 * The nine checks.
 *
 * `crawl` is `null` where the pass never reached the crawl or it raised;
 * `blockedAgents` is the report's own list, read from the same access rules,
 * never recounted here.
 */
export function checkSite(a: {
  crawl: CrawlReading | null;
  robots: Measured<RobotsPolicy>;
  blockedAgents: Blocked;
}): SiteIssuesSection {
  const readers = aiReaders(a.robots, a.blockedAgents);

  if (a.crawl === null || a.crawl.pages.length === 0) {
    const because: CouldNotRun = a.crawl === null ? "crawl_not_run" : "no_pages_read";
    return {
      pagesChecked: 0,
      stoppedBy: a.crawl === null ? "not_run" : a.crawl.stoppedBy,
      issues: SITE_CHECKS.map((check) => (check === "ai_readers_blocked" ? readers : couldNot(check, because))),
    };
  }

  const { pages } = a.crawl;
  const total = pages.length;

  const titles = missingOrDuplicate(pages.map((p) => p.title));
  const descriptions = missingOrDuplicate(pages.map((p) => p.facts.metaDescription));

  // A `noindex` home page is the whole site kept out of search.
  const noindexed = pages.filter((p) => p.facts.noindex).length;
  const noindex =
    pages[0]?.facts.noindex === true
      ? siteWide("noindex_pages", noindexed, total, "pages")
      : perPage("noindex_pages", noindexed, total);

  const sitemap =
    a.crawl.sitemap === "unreadable"
      ? couldNot("sitemap", "sitemap_unreadable")
      : siteWide("sitemap", a.crawl.sitemap === "absent" ? 1 : 0, 1, "site");

  const timed = pages.filter((p) => p.fetchMs !== null);
  const slow =
    timed.length === 0
      ? couldNot("slow_pages", "no_timed_reads")
      : perPage(
          "slow_pages",
          timed.filter((p) => (p.fetchMs ?? 0) >= SITE_ISSUES.SLOW_PAGE_MS).length,
          timed.length
        );

  // Internal link targets, counted once each, over the targets the crawl
  // actually fetched. A target beyond the crawl's set is never guessed at.
  const linked = new Set<string>();
  for (const page of pages) for (const key of page.links) linked.add(key);
  const checkedTargets = [...linked].filter((key) => a.crawl?.fetchedKeys.has(key));
  const broken =
    linked.size > 0 && checkedTargets.length === 0
      ? couldNot("broken_links", "no_links_checked")
      : perPage(
          "broken_links",
          checkedTargets.filter((key) => a.crawl?.brokenKeys.has(key)).length,
          checkedTargets.length,
          "links"
        );

  const issues: Record<SiteCheck, SiteIssue> = {
    page_titles: perPage("page_titles", titles.affected, total, "pages", {
      missing: titles.missing,
      duplicate: titles.duplicate,
    }),
    meta_descriptions: perPage("meta_descriptions", descriptions.affected, total, "pages", {
      missing: descriptions.missing,
      duplicate: descriptions.duplicate,
    }),
    noindex_pages: noindex,
    sitemap,
    slow_pages: slow,
    broken_links: broken,
    phone_usability: perPage("phone_usability", pages.filter((p) => !p.facts.phoneViewport).length, total),
    structured_data: perPage("structured_data", pages.filter((p) => p.facts.schemaTypes === 0).length, total),
    ai_readers_blocked: readers,
  };

  return {
    pagesChecked: total,
    stoppedBy: a.crawl.stoppedBy,
    issues: SITE_CHECKS.map((check) => issues[check]),
  };
}
