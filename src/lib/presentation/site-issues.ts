// SPEC §9 — the words a technical-issue check is stated in, on every
// surface that states one: the free report's cards and the Overview's
// "Needs you". One map, so the report and the dashboard cannot name the same
// check two ways.
import type { IssueSeverity, SiteCheck } from "@/lib/site-issues/types";
import type { CopyKey } from "./copy";
import { SEVERITY } from "./bands";

/** Each check's title. `ai_readers_blocked` is the report's existing
 *  blocked-readers card, so it keeps that card's title. */
export const SITE_CHECK_TITLE: Readonly<Record<SiteCheck, CopyKey>> = Object.freeze({
  page_titles: "check.page-titles.title",
  meta_descriptions: "check.meta-descriptions.title",
  noindex_pages: "check.noindex-pages.title",
  sitemap: "check.sitemap.title",
  slow_pages: "check.slow-pages.title",
  broken_links: "check.broken-links.title",
  phone_usability: "check.phone-usability.title",
  structured_data: "check.structured-data.title",
  ai_readers_blocked: "problem.blocked-readers.title",
});

/** §9's three severity words, from the ordered `SEVERITY` keys. */
export const SITE_SEVERITY_WORD: Readonly<Record<IssueSeverity, CopyKey>> = Object.freeze({
  nothing_to_fix: SEVERITY[0],
  worth_fixing: SEVERITY[1],
  critical: SEVERITY[2],
});
