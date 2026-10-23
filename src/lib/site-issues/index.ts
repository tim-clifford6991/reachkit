// SPEC §9 — the technical-issue scan across the crawled pages.
export { readingOf, type CheckedPage, type CrawlReading } from "./checks";
export { type IssueChange } from "./changes";
export { readPageFacts, type PageIssueFacts } from "./facts";
export {
  type CouldNotRun,
  type IssueDoer,
  type IssueSeverity,
  type IssueUnit,
  type SiteCheck,
  type SiteIssue,
  type SiteIssuesSection,
} from "./types";
