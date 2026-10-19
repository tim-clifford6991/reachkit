// Issue 1550 — the reserved fixture account's stored technical-issue
// section, as a weekly report would hold it. It goes through the same rule
// as a real account's (`waitingIssues`), so the sweep measures what that
// rule lets through: a page address longer than a phone is wide, a slow page
// with its two-read time, a fault of the whole site, and the checks that
// must not show — ReachKit's own work, and a count with no address kept.
import type { SiteIssuesSection } from "@/lib/site-issues/types";

const SITE = "https://example.com";
const LONG_PAGE = `${SITE}/guides/onboarding/how-to-choose-an-onboarding-tool-for-a-small-team-without-a-dedicated-customer-success-person`;

export const FIXTURE_MEASURED_AT = new Date("2026-09-14T06:00:00Z");

export const FIXTURE_SITE_ISSUES: SiteIssuesSection = {
  pagesChecked: 24,
  checkedPages: null,
  stoppedBy: "complete",
  issues: [
    { check: "page_titles", ran: true, count: 2, over: 24, unit: "pages", severity: "worth_fixing", doer: "reachkit_rewrites", pages: [`${SITE}/pricing`, `${SITE}/about`] },
    { check: "meta_descriptions", ran: true, count: 0, over: 24, unit: "pages", severity: "nothing_to_fix", doer: "reachkit_rewrites", pages: [] },
    { check: "noindex_pages", ran: true, count: 1, over: 24, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: [`${SITE}/features/integrations`] },
    { check: "sitemap", ran: true, count: 1, over: 1, unit: "site", severity: "critical", doer: "free_fix", pages: null },
    { check: "slow_pages", ran: true, count: 2, over: 22, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: [LONG_PAGE, `${SITE}/blog`], ms: [4_210, 3_380] },
    // Counted before addresses were kept: nothing to name, so not shown.
    { check: "broken_links", ran: true, count: 3, over: 61, unit: "links", severity: "worth_fixing", doer: "free_fix", pages: null },
    { check: "phone_usability", ran: true, count: 0, over: 24, unit: "pages", severity: "nothing_to_fix", doer: "free_fix", pages: [] },
    { check: "structured_data", ran: true, count: 5, over: 24, unit: "pages", severity: "worth_fixing", doer: "reachkit_writes", pages: [`${SITE}/`] },
    { check: "ai_readers_blocked", ran: false, because: "access_rules_unreadable" },
  ],
};
