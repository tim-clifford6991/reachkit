// Site Fixes draws only from `siteFixesScreen`: over the reserved account's section and the report shapes around it,
// no two numbers that should agree differ, and "nothing to fix" is never said of a check that did not run.
import { describe, expect, it } from "vitest";
import { issuesReading } from "@/app/(account)/app/_overview/alerts";
import { FIXTURE_MEASURED_AT, FIXTURE_SITE_ISSUES as current } from "@/app/(account)/app/issues/fixture";
import { siteFixesScreen, type SiteFixesScreen } from "@/app/(account)/app/issues/screen";
import { copy } from "@/lib/presentation/copy";
import type { SiteIssue, SiteIssuesSection } from "@/lib/site-issues/types";

const ZONE = "America/Chicago";
type Ran = Extract<SiteIssue, { ran: true }>;
const swap = (s: SiteIssuesSection, issue: SiteIssue): SiteIssuesSection => ({ ...s, issues: s.issues.map((i) => (i.check === issue.check ? issue : i)) });
const ran = (check: SiteIssue["check"]) => current.issues.find((i) => i.check === check) as Ran;
const screenOf = (s: SiteIssuesSection, at = FIXTURE_MEASURED_AT) => siteFixesScreen(issuesReading(s, at), ZONE);
// A count kept before addresses were: nothing to name.
const unnamed = (s: SiteIssuesSection) => swap(s, { ...ran("noindex_pages"), count: 1, severity: "worth_fixing", pages: null });
const clean = { ...current, issues: current.issues.map((i) => (i.ran ? { ...i, count: 0, pages: [], severity: "nothing_to_fix" as const } : i)) };

function agrees(screen: SiteFixesScreen, read: number): void {
  expect(screen.summary?.read).toBe(copy("overview.issues.read", { count: String(read) }));
  for (const row of screen.rows) {
    expect(row.pages).toHaveLength(row.named);
    if (row.named > 0) expect(row.share).toContain(`of ${read} pages`);
  }
  const ranks = screen.rows.map((row) => (row.tone === "critical" ? 0 : row.tone === "worth_fixing" ? 1 : 2));
  expect(ranks).toEqual([...ranks].sort());
  const split = screen.summary?.split;
  if (split == null) return;
  expect(split.fine + split.problem).toBe(read);
  for (const row of screen.rows) expect(row.named).toBeLessThanOrEqual(split.problem);
}

describe("Site Fixes' one model", () => {
  it("the reserved account: 31 fine and 9 with a problem, each page once, broken links by the pages that hold them", () => {
    const screen = screenOf(current);
    agrees(screen, 40);
    expect(screen.summary?.split).toMatchObject({ fine: 31, problem: 9 });
    expect(screen.rows.map((r) => r.id)).toEqual(["phone_usability", "slow_pages", "broken_links", "ai_readers_blocked"]);
    expect(screen.rows.find((r) => r.id === "broken_links")?.pages.map((p) => p.url)).toEqual(ran("broken_links").from);
  });

  it("without the pages that hold them, broken links keep their link addresses", () => {
    const old: Ran = { ...ran("broken_links"), from: undefined };
    expect(screenOf(swap(current, old)).rows.find((r) => r.id === "broken_links")?.pages.map((p) => p.url)).toEqual(old.pages);
  });

  it("a report that kept no addresses, or a count kept without them, draws only the pages read", () => {
    const v7 = screenOf({ ...current, checkedPages: null });
    agrees(v7, 40);
    expect(v7.summary?.split).toBeNull();
    expect(screenOf(unnamed(current)).summary?.split).toBeNull();
  });

  it("a page check that did not run is a row of its own and withholds the split; the sitemap does not", () => {
    const slow = screenOf(swap(current, { check: "slow_pages", ran: false, because: "no_timed_reads" }));
    agrees(slow, 40);
    expect(slow.summary?.split).toBeNull();
    expect(slow.rows.at(-1)).toMatchObject({ id: "slow_pages", tone: "not_run", share: null, named: 0 });
    expect(screenOf(swap(current, { check: "sitemap", ran: false, because: "sitemap_unreadable" })).summary?.split).not.toBeNull();
  });

  it("with no row: nothing to fix names the day the pages were read, even without addresses; an unnamed count says so", () => {
    const wednesday = screenOf(clean, new Date("2026-10-21T12:00:00Z"));
    expect(wednesday).toMatchObject({ state: "empty", rows: [] });
    expect(wednesday.line).toMatch(/Wednesday/);
    expect(wednesday.summary?.split).toMatchObject({ fine: 40, problem: 0 });
    expect(screenOf({ ...clean, checkedPages: null }, new Date("2026-10-21T12:00:00Z")).line).toBe(wednesday.line);
    expect(screenOf(unnamed(clean)).line).toBe(copy("overview.issues.unnamed"));
  });
});
