// SPEC §9 — the technical-issue scan across the crawled pages.
export { checkSite, readingOf, type CheckedPage, type CrawlReading } from "./checks";
export { readPageFacts, type PageIssueFacts } from "./facts";
export {
  DOER_OF,
  SITE_CHECKS,
  type CouldNotRun,
  type IssueDoer,
  type IssueSeverity,
  type IssueUnit,
  type SiteCheck,
  type SiteIssue,
  type SiteIssuesSection,
} from "./types";
