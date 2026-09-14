// SPEC §9 — the technical-issue checks, as one closed shape.
//
// Nine checks, run across the crawled profile pages (up to 100, 2026-09-12).
// Each one either ran — and then carries a count, the set that count was
// measured over, one severity and who does the work — or could not run, and
// then carries one reason and nothing that could be read as "no issues
// found". The report cards render these; nothing here is a sentence.

/** §9's nine, in the order the rule lists them. Closed: a tenth check is a
 *  change to what the product measures. */
export const SITE_CHECKS = [
  "page_titles",
  "meta_descriptions",
  "noindex_pages",
  "sitemap",
  "slow_pages",
  "broken_links",
  "phone_usability",
  "structured_data",
  "ai_readers_blocked",
] as const;

export type SiteCheck = (typeof SITE_CHECKS)[number];

/** §9: Critical · Worth fixing · Nothing to fix — ordered low to high, so the
 *  presentation's `SEVERITY` keys (`severity.low/mid/high`) index it. */
export type IssueSeverity = "nothing_to_fix" | "worth_fixing" | "critical";

/** §9: "Free fix · 10 min" / "ReachKit writes" / "ReachKit rewrites". */
export type IssueDoer = "free_fix" | "reachkit_writes" | "reachkit_rewrites";

/** What a count is a count of, so a card can name the set it was measured
 *  over: pages of the crawl, internal links the crawl checked, the site's own
 *  declarations, or the pinned AI readers. */
export type IssueUnit = "pages" | "links" | "site" | "ai_readers";

/** Why a check could not run. One reason each; the card states it and never
 *  a zero. */
export type CouldNotRun =
  /** The pass never reached the crawl, or the crawl raised. */
  | "crawl_not_run"
  /** The crawl ran and read no page of the site. */
  | "no_pages_read"
  /** `robots.txt` could not be read, so no reader can be called blocked. */
  | "access_rules_unreadable"
  /** A sitemap address answered with something other than a document or a
   *  plain "not here" (a timeout, a refusal), and no sitemap was found. */
  | "sitemap_unreadable"
  /** Every page came from the cache, so no fetch was timed. */
  | "no_timed_reads"
  /** Pages link to each other, but none of the linked pages was fetched. */
  | "no_links_checked";

export type SiteIssue =
  | {
      check: SiteCheck;
      ran: true;
      /** How many are affected — pages, links, declarations or readers. */
      count: number;
      /** The size of the set `count` was measured over, in the same unit. */
      over: number;
      unit: IssueUnit;
      severity: IssueSeverity;
      doer: IssueDoer;
      /** For the two missing/duplicate checks: how the count splits. A page
       *  is counted once even when it is both. */
      parts?: { missing: number; duplicate: number };
    }
  | { check: SiteCheck; ran: false; because: CouldNotRun };

/** The whole section, as stored on the report: the nine, in `SITE_CHECKS`
 *  order, and how many pages the crawl read. */
export interface SiteIssuesSection {
  pagesChecked: number;
  /** Why the crawl ended — so "100 pages" reads as a cap, not a whole site. */
  stoppedBy: "complete" | "page_cap" | "time_budget" | "not_run";
  issues: readonly SiteIssue[];
}

/** Who fixes each check — owner ruling 2026-09-14 (SPEC §9), the same map
 *  the report's cards carry (`_problems/checks.ts`). The ids are that
 *  file's too, plus `ai_readers_blocked`, which the report draws as its
 *  existing blocked-readers card. */
export const DOER_OF: Readonly<Record<SiteCheck, IssueDoer>> = Object.freeze({
  page_titles: "reachkit_rewrites",
  meta_descriptions: "reachkit_rewrites",
  structured_data: "reachkit_writes",
  noindex_pages: "free_fix",
  sitemap: "free_fix",
  slow_pages: "free_fix",
  broken_links: "free_fix",
  phone_usability: "free_fix",
  ai_readers_blocked: "free_fix",
});
