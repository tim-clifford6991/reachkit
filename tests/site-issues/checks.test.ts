// tests/site-issues/checks.test.ts — SPEC §9, issue #570
//
// What a customer gets from these checks: the technical faults across the
// pages ReachKit crawled, each with a count and the set it was counted over,
// one severity and who fixes it — and, for a check that could not run, the
// reason instead of a zero.
import { describe, expect, it } from "vitest";
import { AI_READER_AGENTS, SITE_ISSUES } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { parseRobotsTxt } from "@/lib/egress/robots";
import { blockedAgentsOf, trainingOptOutOf } from "@/lib/scan/sections";
import { checkSite, type CheckedPage, type CrawlReading } from "@/lib/site-issues/checks";
import { readPageFacts } from "@/lib/site-issues/facts";
import { SITE_CHECKS, type SiteCheck, type SiteIssue } from "@/lib/site-issues/types";

const AT = new Date("2026-09-14T08:00:00.000Z");

const ROBOTS: Measured<RobotsPolicy> = measured(
  { ok: true, origin: "https://example.com", readAt: AT, disallowsAll: false, disallowedAgents: {}, sitemaps: [], absent: false },
  AT
);

const HEALTHY = { metaDescription: "", noindex: false, phoneViewport: true, schemaTypes: 1 };

function pageAt(n: number, over: Omit<Partial<CheckedPage>, "facts"> & { facts?: Partial<CheckedPage["facts"]> } = {}): CheckedPage {
  return {
    key: `https://example.com/p${n}`,
    title: `Page ${n}`,
    links: [],
    fetchMs: 400,
    ...over,
    facts: { ...HEALTHY, metaDescription: `About page ${n}`, ...over.facts },
  };
}

function crawl(pages: CheckedPage[], over: Partial<CrawlReading> = {}): CrawlReading {
  return {
    pages,
    fetchedKeys: new Set(pages.map((p) => p.key)),
    brokenKeys: new Set(),
    sitemap: "found",
    stoppedBy: "complete",
    ...over,
  };
}

function issue(section: { issues: readonly SiteIssue[] }, check: SiteCheck): SiteIssue {
  const found = section.issues.find((i) => i.check === check);
  if (found === undefined) throw new Error(`no ${check}`);
  return found;
}

function ran(i: SiteIssue): Extract<SiteIssue, { ran: true }> {
  if (!i.ran) throw new Error(`${i.check} did not run: ${i.because}`);
  return i;
}

describe("the nine checks, over the crawled set", () => {
  it("always states all nine, in §9's order", () => {
    const section = checkSite({ crawl: crawl([pageAt(1)]), robots: ROBOTS, blockedAgents: [] });
    expect(section.issues.map((i) => i.check)).toEqual([...SITE_CHECKS]);
    expect(section.pagesChecked).toBe(1);
  });

  it("a healthy site is nine measured zeros, each saying Nothing to fix", () => {
    const pages = [pageAt(1, { links: ["https://example.com/p2"] }), pageAt(2)];
    const section = checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] });
    for (const i of section.issues) {
      expect(ran(i).count, i.check).toBe(0);
      expect(ran(i).severity, i.check).toBe("nothing_to_fix");
    }
  });

  it("counts duplicate and missing titles across the set, each page once, and names the set", () => {
    const pages = [
      pageAt(1, { title: "Pricing" }),
      pageAt(2, { title: " pricing " }),
      pageAt(3, { title: "" }),
      pageAt(4),
      pageAt(5),
      pageAt(6),
      pageAt(7),
      pageAt(8),
      pageAt(9),
      pageAt(10),
      pageAt(11),
      pageAt(12),
    ];
    const titles = ran(issue(checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] }), "page_titles"));
    expect(titles).toMatchObject({ count: 3, over: 12, unit: "pages", parts: { missing: 1, duplicate: 2 } });
    // The pages themselves, so a Fix opportunity can name each (#690).
    expect(titles.pages).toEqual(["https://example.com/p1", "https://example.com/p2", "https://example.com/p3"]);
    // 3 of 12 is 25%: the share at which a per-page fault turns Critical.
    expect(3 / 12).toBe(SITE_ISSUES.CRITICAL_PAGE_SHARE);
    expect(titles.severity).toBe("critical");
    expect(titles.doer).toBe("reachkit_rewrites");
  });

  it("counts duplicate meta descriptions the same way, and one affected page in many is Worth fixing", () => {
    const pages = [pageAt(1, { facts: { metaDescription: "Same" } }), pageAt(2, { facts: { metaDescription: "Same" } })];
    for (let n = 3; n <= 10; n++) pages.push(pageAt(n));
    const descriptions = ran(issue(checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] }), "meta_descriptions"));
    expect(descriptions).toMatchObject({ count: 2, over: 10, parts: { missing: 0, duplicate: 2 }, severity: "worth_fixing" });
  });

  it("counts broken internal links over the linked pages the crawl fetched — never beyond them", () => {
    const pages = [
      pageAt(1, { links: ["https://example.com/gone", "https://example.com/p2", "https://example.com/never-read"] }),
      pageAt(2, { links: ["https://example.com/gone"] }),
    ];
    const reading = crawl(pages, {
      fetchedKeys: new Set(["https://example.com/p1", "https://example.com/p2", "https://example.com/gone"]),
      brokenKeys: new Set(["https://example.com/gone"]),
    });
    const broken = ran(issue(checkSite({ crawl: reading, robots: ROBOTS, blockedAgents: [] }), "broken_links"));
    // One broken target, linked twice, counted once — over the two linked
    // targets the crawl fetched. The page it never read is not counted.
    expect(broken).toMatchObject({ count: 1, over: 2, unit: "links", severity: "critical", doer: "free_fix" });
    // Issue 1550: the address is kept, so the customer is told which one.
    expect(broken.pages).toEqual(["https://example.com/gone"]);
  });

  it("a noindex home page is a site-wide fault — Critical — while one noindexed page among many is not", () => {
    const home = checkSite({
      crawl: crawl([pageAt(1, { facts: { noindex: true } }), ...[2, 3, 4, 5, 6].map((n) => pageAt(n))]),
      robots: ROBOTS,
      blockedAgents: [],
    });
    expect(ran(issue(home, "noindex_pages"))).toMatchObject({ count: 1, severity: "critical" });

    const deep = checkSite({
      crawl: crawl([...[1, 2, 3, 4, 5].map((n) => pageAt(n)), pageAt(6, { facts: { noindex: true } })]),
      robots: ROBOTS,
      blockedAgents: [],
    });
    expect(ran(issue(deep, "noindex_pages"))).toMatchObject({ count: 1, severity: "worth_fixing" });
  });

  it("no sitemap and a blocked AI reader are named issues, Critical, and the customer's free fix", () => {
    const section = checkSite({
      crawl: crawl([pageAt(1)], { sitemap: "absent" }),
      robots: ROBOTS,
      blockedAgents: [AI_READER_AGENTS[0]],
    });
    expect(ran(issue(section, "sitemap"))).toMatchObject({ count: 1, severity: "critical", doer: "free_fix" });
    expect(ran(issue(section, "ai_readers_blocked"))).toMatchObject({
      count: 1,
      over: AI_READER_AGENTS.length + 1,
      unit: "ai_readers",
      severity: "critical",
    });
  });

  it("a page that forbids snippets is counted with the blocked answer readers and named", () => {
    const section = checkSite({
      crawl: crawl([pageAt(1), pageAt(2, { facts: { snippetBlocked: true } }), ...[3, 4, 5, 6].map((n) => pageAt(n))]),
      robots: ROBOTS,
      blockedAgents: [],
    });
    expect(ran(issue(section, "ai_readers_blocked"))).toMatchObject({
      count: 1,
      severity: "worth_fixing",
      doer: "free_fix",
      pages: ["https://example.com/p2"],
    });
  });

  it("slow pages are counted over the pages whose fetch was timed, at the pinned bound, where two reads agree", () => {
    const pages = [
      pageAt(1, { fetchMs: SITE_ISSUES.SLOW_PAGE_MS + 900, againMs: SITE_ISSUES.SLOW_PAGE_MS }),
      pageAt(2, { fetchMs: SITE_ISSUES.SLOW_PAGE_MS - 1 }),
      pageAt(3, { fetchMs: null }),
    ];
    const slow = ran(issue(checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] }), "slow_pages"));
    expect(slow).toMatchObject({ count: 1, over: 2, pages: [pages[0]?.key], ms: [SITE_ISSUES.SLOW_PAGE_MS] });
  });

  // Issue 1550: one slow read is a cold start as often as a slow page.
  it("a page slow on one read and quick on the next, or read only once, is not slow", () => {
    const pages = [
      pageAt(1, { fetchMs: SITE_ISSUES.SLOW_PAGE_MS + 2_000, againMs: 400 }),
      pageAt(2, { fetchMs: SITE_ISSUES.SLOW_PAGE_MS + 2_000, againMs: null }),
      pageAt(3, { fetchMs: SITE_ISSUES.SLOW_PAGE_MS + 2_000 }),
    ];
    const slow = ran(issue(checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] }), "slow_pages"));
    expect(slow).toMatchObject({ count: 0, over: 3, severity: "nothing_to_fix", pages: [], ms: [] });
  });

  it("counts pages a phone cannot use and pages with no structured data", () => {
    const pages = [pageAt(1, { facts: { phoneViewport: false, schemaTypes: 0 } }), pageAt(2)];
    const section = checkSite({ crawl: crawl(pages), robots: ROBOTS, blockedAgents: [] });
    expect(ran(issue(section, "phone_usability"))).toMatchObject({ count: 1, over: 2, doer: "free_fix" });
    expect(ran(issue(section, "structured_data"))).toMatchObject({ count: 1, over: 2, doer: "reachkit_writes" });
  });
});

describe("a check that could not run says why — never 'no issues found'", () => {
  it("no crawl: every page check carries crawl_not_run, and the AI-reader check still runs off robots.txt", () => {
    const section = checkSite({ crawl: null, robots: ROBOTS, blockedAgents: [] });
    expect(section.stoppedBy).toBe("not_run");
    for (const i of section.issues) {
      if (i.check === "ai_readers_blocked") expect(ran(i).count).toBe(0);
      else expect(i).toEqual({ check: i.check, ran: false, because: "crawl_not_run" });
    }
  });

  it("a crawl that read no page says so, rather than counting zero faults on zero pages", () => {
    const section = checkSite({ crawl: crawl([]), robots: ROBOTS, blockedAgents: [] });
    expect(issue(section, "page_titles")).toEqual({ check: "page_titles", ran: false, because: "no_pages_read" });
  });

  it("each check's own reason: unreadable robots, unreadable sitemap, no timed fetch, no linked page fetched", () => {
    const pages = [pageAt(1, { fetchMs: null, links: ["https://example.com/elsewhere"] })];
    const section = checkSite({
      crawl: crawl(pages, { sitemap: "unreadable" }),
      robots: unmeasured("undeterminable", AT),
      blockedAgents: [],
    });
    const reasons = Object.fromEntries(section.issues.filter((i) => !i.ran).map((i) => [i.check, !i.ran && i.because]));
    expect(reasons).toEqual({
      sitemap: "sitemap_unreadable",
      slow_pages: "no_timed_reads",
      broken_links: "no_links_checked",
      ai_readers_blocked: "access_rules_unreadable",
    });
  });
});

describe("answer readers and training crawlers are two lists (SPEC §9, D14, issue 1145)", () => {
  const policyOf = (text: string): Measured<RobotsPolicy> =>
    measured({ ok: true, origin: "https://example.com", readAt: AT, absent: false, ...parseRobotsTxt(text) }, AT);

  it("a robots.txt that blocks only GPTBot and Google-Extended reports no blocked answer reader", () => {
    const robots = policyOf("User-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n");
    const blockedAgents = blockedAgentsOf(robots);
    expect(blockedAgents).toEqual([]);
    expect(trainingOptOutOf(robots)).toEqual(["GPTBot", "Google-Extended"]);
    const section = checkSite({ crawl: crawl([pageAt(1)]), robots, blockedAgents });
    expect(ran(issue(section, "ai_readers_blocked"))).toMatchObject({ count: 0, severity: "nothing_to_fix" });
  });

  it("a blocked Googlebot is a blocked answer reader", () => {
    expect(blockedAgentsOf(policyOf("User-agent: googlebot\nDisallow: /\n"))).toEqual(["Googlebot"]);
  });

  it("a page that forbids snippets is read as one; a marked aside is not", () => {
    const page = (head: string, body: string): boolean | undefined =>
      readPageFacts("https://example.com/", `<html><head>${head}</head><body>${body}</body></html>`).snippetBlocked;
    const prose = "<p>What the product does, in enough words to be the page.</p>";
    expect(page('<meta name="robots" content="index, nosnippet">', prose)).toBe(true);
    expect(page('<meta name="googlebot" content="max-snippet: 0">', prose)).toBe(true);
    expect(page("", `<main><div data-nosnippet>${prose}</div></main>`)).toBe(true);
    expect(page('<meta name="robots" content="max-snippet:160">', prose)).toBe(false);
    expect(page('<meta name="gptbot" content="nosnippet">', prose)).toBe(false);
    expect(page("", `<main>${prose}${prose}<span data-nosnippet>€49</span></main>`)).toBe(false);
  });
});
