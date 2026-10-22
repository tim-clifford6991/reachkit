// tests/app/issues/page.test.tsx — issue 1550: a needs-you technical issue
// opens the account's own view, which names the pages and says what to do,
// and is never the public report with its checkout. Issue 1752: its sections
// are board `AppIssues`' — lead, summary, problem cards, and the empty arm.
import "../../generate/env";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { copy } from "@/lib/presentation/copy";
import { issuesReading, readAlerts, waitingIssues } from "@/app/(account)/app/_overview/alerts";
import { FIXTURE_MEASURED_AT, FIXTURE_SITE_ISSUES } from "@/app/(account)/app/issues/fixture";
import IssuesPage from "@/app/(account)/app/issues/page";
import { IssuesView } from "@/app/(account)/app/issues/view";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import { resetAccount, signedInAs } from "../account-door";

afterEach(resetAccount);

async function rendered(): Promise<string> {
  signedInAs();
  return renderToStaticMarkup(await IssuesPage());
}

describe("Technical issues, where a needs-you item lands", () => {
  it("each alert opens a check this view draws, with its fix line and its pages", async () => {
    const markup = await rendered();
    const { alerts } = readAlerts(waitingIssues(FIXTURE_SITE_ISSUES, { measuredAt: FIXTURE_MEASURED_AT }), FIXTURE_MEASURED_AT);
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts) {
      const [path, check] = alert.href.split("#");
      expect(path).toBe("/app/issues");
      expect(markup).toContain(`id="${check}"`);
    }
    const slow = FIXTURE_SITE_ISSUES.issues.find((i) => i.check === "slow_pages");
    if (slow === undefined || !slow.ran || slow.pages === null) throw new Error("fixture has no slow pages");
    for (const page of slow.pages) expect(markup).toContain(page);
    expect(markup).toContain(copy("check.slow-pages.fix"));
    expect(markup).toContain(copy("overview.issues.seconds", { seconds: "4.2" }));
  });

  it("is not the public report: no report link and no checkout", async () => {
    const markup = await rendered();
    expect(markup).not.toContain("/scan/");
    expect(markup).not.toMatch(/checkout|pricing/i);
  });

  it("draws no check the customer has nothing to act on", async () => {
    const markup = await rendered();
    // ReachKit's own work, and hidden pages counted with no address kept.
    expect(markup).not.toContain('data-check="page_titles"');
    expect(markup).not.toContain('data-check="structured_data"');
    expect(markup).not.toContain('data-check="noindex_pages"');
  });
});

/** The text of the element carrying `testId`, tags dropped. */
function textOf(markup: string, testId: string): string {
  const at = markup.indexOf(`data-testid="${testId}"`);
  if (at < 0) throw new Error(`no ${testId}`);
  const open = markup.lastIndexOf("<", at);
  const tag = /^<(\w+)/.exec(markup.slice(open))![1];
  const close = markup.indexOf(`</${tag}>`, at);
  return markup.slice(open, close).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

describe("Technical issues, as board AppIssues lays it out", () => {
  it("leads with what these are, that fixing is optional, and the day the scan found them", async () => {
    const markup = await rendered();
    const lead = textOf(markup, "issues-lead");
    expect(lead).toContain(copy("overview.issues.lead"));
    expect(lead).toContain(copy("overview.issues.found", { date: "Monday, October 19" }));
    expect(markup).toContain(copy("chrome.back-to-overview"));
  });

  it("sums up the pages read, the pages with nothing to fix, and that ReachKit's pages are not affected", async () => {
    const markup = await rendered();
    expect(markup).toContain(copy("overview.issues.read", { count: "40" }));
    expect(textOf(markup, "issues-fine")).toBe(`31${copy("overview.issues.fine")}`);
    expect(markup).toContain(copy("overview.issues.affected", { pages: "9", problems: "3" }));
    expect(markup).toContain(copy("overview.issues.ours"));
    expect(textOf(markup, "issues-legend")).toBe("3 phone4 slow2 broken links31 fine");
    // The summary stands above the first problem card.
    expect(markup.indexOf('data-testid="issues-summary"')).toBeLessThan(markup.indexOf('data-testid="issue"'));
  });

  it("gives each problem its severity, its share of the pages read, the fix, who can do it, and its pages behind one control", async () => {
    const markup = await rendered();
    const order = [...markup.matchAll(/data-check="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["phone_usability", "slow_pages", "broken_links", "ai_readers_blocked"]);
    const phone = markup.slice(markup.indexOf('data-check="phone_usability"'), markup.indexOf('data-check="slow_pages"'));
    expect(phone).toContain(copy("severity.high"));
    expect(phone).toContain(copy("overview.issues.share", { count: "3", over: "40" }));
    expect(phone).toContain(`<strong>${copy("overview.issues.fix")}</strong> ${copy("check.phone-usability.fix")}`);
    expect(phone).toContain(copy("overview.issues.who"));
    expect(phone).toMatch(new RegExp(`<summary[^>]*>${copy("overview.issues.show", { count: "3" })}</summary>`));
    // A fault of the whole site names no share and no list.
    const site = markup.slice(markup.indexOf('data-check="ai_readers_blocked"'));
    expect(site).toContain(copy("overview.issues.site"));
    expect(site).not.toContain("<summary");
  });

  it("counts a page named by two problems once, and says so for one page", () => {
    const section: SiteIssuesSection = {
      pagesChecked: 12,
      checkedPages: null,
      stoppedBy: "complete",
      issues: [
        { check: "slow_pages", ran: true, count: 1, over: 12, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: ["https://a.example/x"], ms: [4_500] },
        { check: "phone_usability", ran: true, count: 1, over: 12, unit: "pages", severity: "critical", doer: "free_fix", pages: ["https://a.example/x"] },
      ],
    };
    const markup = renderToStaticMarkup(
      <IssuesView reading={issuesReading(section, FIXTURE_MEASURED_AT)} timeZone="America/New_York" />
    );
    expect(textOf(markup, "issues-fine")).toBe(`11${copy("overview.issues.fine")}`);
    expect(markup).toContain(copy("overview.issues.affected.one-page"));
    expect(markup).toContain(copy("overview.issues.show.one"));
  });

  it("with nothing to fix, says so and when the next check is, with no summary", () => {
    const clean: SiteIssuesSection = { ...FIXTURE_SITE_ISSUES, issues: [] };
    const markup = renderToStaticMarkup(
      <IssuesView reading={issuesReading(clean, FIXTURE_MEASURED_AT)} timeZone="America/New_York" />
    );
    expect(textOf(markup, "issues-empty")).toBe(copy("overview.issues.empty"));
    expect(markup).not.toContain('data-testid="issues-summary"');
  });

  it("with no stored reading, states no day, no count, and never that nothing needs fixing", () => {
    const markup = renderToStaticMarkup(<IssuesView reading={issuesReading(null, null)} timeZone="America/New_York" />);
    expect(textOf(markup, "issues-lead")).toBe(copy("overview.issues.lead"));
    expect(textOf(markup, "issues-unscanned")).toBe(copy("overview.issues.unscanned"));
    expect(markup).not.toContain('data-testid="issues-empty"');
    expect(markup).not.toContain('data-testid="issues-summary"');
  });
});
