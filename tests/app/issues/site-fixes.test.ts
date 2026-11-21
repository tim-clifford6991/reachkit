// Site Fixes draws only from `siteFixesScreen`: over the reserved account's section and the report shapes around it,
// no two numbers that should agree differ, and "nothing to fix" is never said of a check that did not run.
import { describe, expect, it } from "vitest";
import { issuesReading } from "@/app/(account)/app/_overview/alerts";
import { FIXTURE_MEASURED_AT, FIXTURE_SITE_ISSUES } from "@/app/(account)/app/issues/fixture";
import { siteFixesScreen, type SiteFixesScreen } from "@/app/(account)/app/issues/screen";
import type { SiteIssue, SiteIssuesSection } from "@/lib/site-issues/types";

const ZONE = "America/Chicago";
const READ = Array.from({ length: 40 }, (_, i) => `https://example.com/p${i}`);
const named = (s: SiteIssuesSection) => s.issues.flatMap((i) => (i.ran ? [...(i.pages ?? []), ...(i.from ?? [])] : []));
// The fixture as a current report: every page read is kept, and the count kept without addresses is gone.
const current: SiteIssuesSection = {
  ...FIXTURE_SITE_ISSUES,
  issues: FIXTURE_SITE_ISSUES.issues.filter((i) => i.check !== "noindex_pages"),
  checkedPages: [...new Set([...named(FIXTURE_SITE_ISSUES), ...READ])].slice(0, 40),
};
const swap = (s: SiteIssuesSection, issue: SiteIssue): SiteIssuesSection => ({ ...s, issues: s.issues.map((i) => (i.check === issue.check ? issue : i)) });
const screenOf = (s: SiteIssuesSection, at = FIXTURE_MEASURED_AT) => siteFixesScreen(issuesReading(s, at), ZONE);

function agrees(screen: SiteFixesScreen): void {
  const { stats, rows } = screen;
  expect(stats).not.toBeNull();
  for (const row of rows) {
    expect(row.pages).toHaveLength(row.named);
    if (row.named > 0) expect(row.share).toContain(`of ${stats!.read} pages`);
  }
  const ranks = rows.map((row) => (row.tone === "critical" ? 0 : row.tone === "worth_fixing" ? 1 : 2));
  expect(ranks).toEqual([...ranks].sort());
  if (stats!.split === null) return;
  expect(stats!.split.fine + stats!.split.problem).toBe(stats!.read);
  for (const row of rows) expect(row.named).toBeLessThanOrEqual(stats!.split.problem);
}

describe("Site Fixes' one model", () => {
  it("the reserved account: rows agree, and a count kept without addresses withholds the split", () => {
    const screen = screenOf(FIXTURE_SITE_ISSUES);
    agrees(screen);
    expect(screen.stats?.split).toBeNull();
    expect(screen.rows.map((r) => r.id)).toEqual(["phone_usability", "slow_pages", "broken_links", "ai_readers_blocked"]);
  });

  it("a current report splits the pages read into fine and not, each page once", () => {
    const screen = screenOf(current);
    agrees(screen);
    expect(screen.stats?.split?.problem).toBe(9);
  });

  it("a report that kept no addresses draws only the pages read", () => {
    expect(screenOf({ ...current, checkedPages: null }).stats?.split).toBeNull();
  });

  it("a page check that did not run is a row of its own and withholds the split; the sitemap does not", () => {
    const slow = screenOf(swap(current, { check: "slow_pages", ran: false, because: "no_timed_reads" }));
    agrees(slow);
    expect(slow.stats?.split).toBeNull();
    expect(slow.rows.at(-1)).toMatchObject({ id: "slow_pages", tone: "not_run", share: null, named: 0 });
    expect(screenOf(swap(current, { check: "sitemap", ran: false, because: "sitemap_unreadable" })).stats?.split).not.toBeNull();
  });

  it("broken links count the pages that hold them where the report kept them, else the links", () => {
    const broken = FIXTURE_SITE_ISSUES.issues.find((i) => i.check === "broken_links")!;
    const holders = [READ[30], READ[31], READ[32]];
    const withFrom = screenOf(swap(current, { ...(broken as Extract<SiteIssue, { ran: true }>), from: holders }));
    agrees(withFrom);
    expect(withFrom.rows.find((r) => r.id === "broken_links")?.pages.map((p) => p.url)).toEqual(holders);
    expect(screenOf(current).rows.find((r) => r.id === "broken_links")?.named).toBe(2);
  });

  it("nothing to fix names the day the pages were read, never a fixed weekday", () => {
    const clean = { ...current, issues: current.issues.map((i) => (i.ran ? { ...i, count: 0, pages: [], severity: "nothing_to_fix" as const } : i)) };
    const wednesday = screenOf(clean, new Date("2026-10-21T12:00:00Z"));
    expect(wednesday).toMatchObject({ state: "empty", rows: [] });
    expect(wednesday.line).toMatch(/Wednesday/);
    expect(wednesday.stats?.split).toEqual(expect.objectContaining({ fine: 40, problem: 0 }));
  });
});
