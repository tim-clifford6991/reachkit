// Issue 1550 — the reserved fixture account's stored technical-issue
// section, as a weekly report would hold it. It goes through the same rule
// as a real account's (`waitingIssues`), so the sweep measures what that
// rule lets through: the board's three problems over 40 pages read, a page
// address longer than a phone is wide, a slow page with its two-read time,
// a fault of the whole site, and the checks that must not show — ReachKit's
// own work, and a count with no address kept.
import type { SiteIssuesSection } from "@/lib/site-issues/types";

const SITE = "https://example.com";
const LONG_PAGE = `${SITE}/guides/onboarding/how-to-choose-an-onboarding-tool-for-a-small-team-without-a-dedicated-customer-success-person`;

// Midday, so it is Monday in every zone a fixture account can publish in.
export const FIXTURE_MEASURED_AT = new Date("2026-10-19T12:00:00Z");

export const FIXTURE_SITE_ISSUES: SiteIssuesSection = {
  pagesChecked: 40,
  checkedPages: null,
  stoppedBy: "complete",
  issues: [
    { check: "page_titles", ran: true, count: 2, over: 40, unit: "pages", severity: "worth_fixing", doer: "reachkit_rewrites", pages: [`${SITE}/pricing`, `${SITE}/about`] },
    { check: "meta_descriptions", ran: true, count: 0, over: 40, unit: "pages", severity: "nothing_to_fix", doer: "reachkit_rewrites", pages: [] },
    // Counted before addresses were kept: nothing to name, so not shown.
    { check: "noindex_pages", ran: true, count: 1, over: 40, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: null },
    { check: "sitemap", ran: true, count: 0, over: 1, unit: "site", severity: "nothing_to_fix", doer: "free_fix", pages: null },
    { check: "slow_pages", ran: true, count: 4, over: 38, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: [`${SITE}/`, LONG_PAGE, `${SITE}/gallery`, `${SITE}/reviews`], ms: [4_210, 5_380, 4_020, 4_650] },
    { check: "broken_links", ran: true, count: 2, over: 61, unit: "links", severity: "worth_fixing", doer: "free_fix", pages: [`${SITE}/specials-2024`, `${SITE}/blog/old-post`] },
    { check: "phone_usability", ran: true, count: 3, over: 40, unit: "pages", severity: "critical", doer: "free_fix", pages: [`${SITE}/coupons`, `${SITE}/financing`, `${SITE}/careers`] },
    { check: "structured_data", ran: true, count: 5, over: 40, unit: "pages", severity: "worth_fixing", doer: "reachkit_writes", pages: [`${SITE}/`] },
    // Readers blocked in robots.txt and no page hidden: a fault of the whole site.
    { check: "ai_readers_blocked", ran: true, count: 2, over: 6, unit: "ai_readers", severity: "worth_fixing", doer: "free_fix", pages: [] },
  ],
};
