// Who runs the site, over every page the crawl read, and on a report stored
// before the reading was kept: the home page's stored types, at 0¢.
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import type { RobotsPolicy } from "@/lib/egress/types";
import { checkSite, identityReading, type CheckedPage } from "@/lib/site-issues/checks";
import { readPageFacts } from "@/lib/site-issues/facts";
import { panelReport } from "../app/scan-address/panel-report";

const AT = new Date("2026-10-23T08:00:00.000Z");
const ROBOTS = measured<RobotsPolicy>(
  { ok: true, origin: "https://example.com", readAt: AT, disallowsAll: false, disallowedAgents: {}, sitemaps: [], absent: false },
  AT
);

const labelled = (...types: string[]): string =>
  `<html><head>${types.map((t) => `<script type="application/ld+json">{"@context":"https://schema.org","@type":"${t}"}</script>`).join("")}</head><body></body></html>`;

function page(path: string, html: string): CheckedPage {
  const key = `https://example.com${path}`;
  return { key, title: path, facts: readPageFacts(key, html), links: [], fetchMs: 300 };
}

function section(pages: CheckedPage[]) {
  return checkSite({
    crawl: { pages, fetchedKeys: new Set(pages.map((p) => p.key)), brokenKeys: new Set(), sitemap: "found", stoppedBy: "complete" },
    robots: ROBOTS,
    blockedAgents: [],
  });
}

describe("a new scan reads every crawled page", () => {
  it("a creator who says who they are only on /about is found there", () => {
    const s = section([page("/", labelled("WebSite")), page("/about", labelled("Person")), page("/blog", labelled("BlogPosting"))]);
    expect(s.identity).toEqual({ kind: "person", type: "Person", page: "https://example.com/about" });
    expect(identityReading(s, null)).toEqual({ kind: "found", type: "Person" });
  });

  it("a site whose every page labels only breadcrumbs says no one runs it", () => {
    const s = section([page("/", labelled("BreadcrumbList")), page("/services", labelled("BreadcrumbList"))]);
    expect(s.identity).toBeNull();
    expect(identityReading(s, ["breadcrumblist"])).toEqual({ kind: "none" });
  });

  it("a crawl that could not run did not measure it", () => {
    const s = checkSite({ crawl: null, robots: ROBOTS, blockedAgents: [] });
    expect(s.identity).toBeUndefined();
    expect(identityReading(s, null)).toEqual({ kind: "not_measured" });
  });

  it("the nine checks are unchanged by the reading", () => {
    const s = section([page("/", labelled("Plumber"))]);
    expect(s.issues).toHaveLength(9);
    expect(s.issues.find((i) => i.check === "structured_data")).toMatchObject({ ran: true, count: 0 });
  });
});

describe("a stored report retrofits from its home page", () => {
  it("a stored local plumber's home LocalBusiness is found, and nothing is rewritten", () => {
    const report = panelReport("local");
    expect(report.siteIssues?.identity).toBeUndefined();
    const home = report.onPage.kind === "unmeasured" ? null : report.onPage.value.schemaTypes;
    expect(identityReading(report.siteIssues, home)).toEqual({ kind: "found", type: "LocalBusiness" });
    expect(identityReading(report.siteIssues, ["plumber", "localbusiness"])).toEqual({ kind: "found", type: "Plumber" });
  });

  it("a stored home with only breadcrumbs is not measured, never none", () => {
    const report = panelReport("saas");
    expect(identityReading(report.siteIssues, ["breadcrumblist"])).toEqual({ kind: "not_measured" });
    expect(identityReading(null, ["breadcrumblist"])).toEqual({ kind: "not_measured" });
  });
});
