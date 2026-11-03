// tests/app/issues/page.test.tsx — issue 1550: a needs-you technical issue
// opens the account's own view, which names the pages and says what to do,
// and is never the public report with its checkout. Its sections are board
// `AppIssues`' — lead, summary, problem cards, and the empty arm.
import "../../generate/env";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
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

  it("names the checks the customer fixes as problems", () => {
    const section: SiteIssuesSection = {
      pagesChecked: 12,
      checkedPages: null,
      stoppedBy: "complete",
      issues: [
        { check: "sitemap", ran: true, count: 1, over: 1, unit: "site", severity: "worth_fixing", doer: "free_fix", pages: null },
        { check: "ai_readers_blocked", ran: true, count: 2, over: 6, unit: "ai_readers", severity: "worth_fixing", doer: "free_fix", pages: [] },
      ],
    };
    const markup = renderToStaticMarkup(
      <IssuesView reading={issuesReading(section, FIXTURE_MEASURED_AT)} timeZone="America/New_York" />
    );
    expect(markup).toContain("No page list for Google");
    expect(markup).toContain("AI shut out of your site");
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
  it("leads with what these are, who can fix them, said once, and the day the scan found them", async () => {
    const markup = await rendered();
    expect(textOf(markup, "issues-lead")).toBe(
      "Optional. Whoever runs your website can make them; ReachKit can’t. Found Monday, October 19."
    );
    expect(markup.split("Whoever runs your website")).toHaveLength(2);
    expect(markup).toContain(copy("chrome.back-to-overview"));
  });

  it("sums up the pages read, the pages with nothing to fix, and that ReachKit's pages are checked, with no bar or legend", async () => {
    const markup = await rendered();
    expect(textOf(markup, "issues-summary")).toBe(
      "Your site, 40 pages read31pages with nothing to fix9 pages have a problem. Your ReachKit pages are checked before they go live."
    );
    // The summary stands above the first problem card.
    expect(markup.indexOf('data-testid="issues-summary"')).toBeLessThan(markup.indexOf('data-testid="issue"'));
  });

  it("gives each problem its severity, its share of the pages read, the fix, and its pages behind one control, with no track", async () => {
    const markup = await rendered();
    const order = [...markup.matchAll(/data-check="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(["phone_usability", "slow_pages", "broken_links", "ai_readers_blocked"]);
    const phone = markup.slice(markup.indexOf('data-check="phone_usability"'), markup.indexOf('data-check="slow_pages"'));
    expect(phone).toContain(copy("severity.high"));
    expect(textOf(phone, "issue-share")).toBe("3 of 40 pages");
    expect(phone).toContain(`<strong>${copy("overview.issues.fix")}</strong> ${copy("check.phone-usability.fix")}`);
    expect(phone).toMatch(new RegExp(`<summary[^>]*><svg[^>]*lucide-chevron-down[^>]*>.*?</svg>${copy("overview.issues.show", { count: "3" })}</summary>`));
    expect(markup).not.toContain("<progress");
    const slow = markup.slice(markup.indexOf('data-check="slow_pages"'), markup.indexOf('data-check="broken_links"'));
    expect(slow).toContain(">Each took 3 seconds or more, twice.</p>");
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
    const clean: SiteIssuesSection = {
      ...FIXTURE_SITE_ISSUES,
      issues: FIXTURE_SITE_ISSUES.issues.map((issue) =>
        issue.ran ? { ...issue, count: 0, severity: "nothing_to_fix" as const, pages: [], ms: undefined } : issue
      ),
    };
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

  it("with a scan that read no section, or ran no check, states no day, no count, and never that nothing needs fixing", () => {
    const ranNothing: SiteIssuesSection = {
      ...FIXTURE_SITE_ISSUES,
      issues: FIXTURE_SITE_ISSUES.issues.map((issue) => ({ check: issue.check, ran: false, because: "crawl_not_run" })),
    };
    for (const reading of [issuesReading(null, FIXTURE_MEASURED_AT), issuesReading(ranNothing, FIXTURE_MEASURED_AT)]) {
      const markup = renderToStaticMarkup(<IssuesView reading={reading} timeZone="America/New_York" />);
      expect(textOf(markup, "issues-lead")).toBe(copy("overview.issues.lead"));
      expect(textOf(markup, "issues-unscanned")).toBe(copy("overview.issues.unscanned"));
      expect(markup).not.toContain('data-testid="issues-empty"');
    }
  });

  it("with a report that could not be read, says so and draws no arm", () => {
    const markup = renderToStaticMarkup(<IssuesView reading={null} timeZone="UTC" />);
    expect(markup).toContain(copy("overview.issues.unreadable"));
    expect(markup).not.toContain('data-testid="issues-unscanned"');
    expect(markup).not.toContain('data-testid="issues-empty"');
  });
});

/** Every check a card can carry, with pages where the check names them, and one critical. */
const EVERY_CARD: SiteIssuesSection = {
  pagesChecked: 12,
  checkedPages: null,
  stoppedBy: "complete",
  issues: [
    { check: "noindex_pages", ran: true, count: 1, over: 12, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: ["https://a.example/hidden"] },
    { check: "sitemap", ran: true, count: 1, over: 1, unit: "site", severity: "worth_fixing", doer: "free_fix", pages: null },
    { check: "slow_pages", ran: true, count: 1, over: 12, unit: "pages", severity: "worth_fixing", doer: "free_fix", pages: ["https://a.example/slow"], ms: [4_500] },
    { check: "broken_links", ran: true, count: 1, over: 20, unit: "links", severity: "worth_fixing", doer: "free_fix", pages: ["https://a.example/old"] },
    { check: "phone_usability", ran: true, count: 1, over: 12, unit: "pages", severity: "critical", doer: "free_fix", pages: ["https://a.example/phone"] },
    { check: "ai_readers_blocked", ran: true, count: 2, over: 6, unit: "ai_readers", severity: "worth_fixing", doer: "free_fix", pages: [] },
  ],
};

function everyCard() {
  return parse(renderToStaticMarkup(<IssuesView reading={issuesReading(EVERY_CARD, FIXTURE_MEASURED_AT)} timeZone="UTC" />));
}

describe("Technical issues, the cards' marks as board AppIssues draws them", () => {
  it("each issue card opens with its check icon", () => {
    const icon: Record<string, string> = {
      noindex_pages: "eye-off",
      sitemap: "list-tree",
      slow_pages: "gauge",
      broken_links: "unlink",
      phone_usability: "smartphone",
      ai_readers_blocked: "lock",
    };
    const cards = everyCard().querySelectorAll('[data-testid="issue"]');
    expect(cards.map((c) => c.getAttribute("data-check")).sort()).toEqual(Object.keys(icon).sort());
    for (const card of cards) {
      const check = card.getAttribute("data-check")!;
      const head = card.querySelector(".card-body > div")!;
      const tile = head.firstElementChild!;
      expect(tile.getAttribute("data-testid"), check).toBe("issue-tile");
      expect(tile.getAttribute("aria-hidden"), check).toBe("true");
      expect(tile.querySelector("svg")!.classList.contains(`lucide-${icon[check]}`), check).toBe(true);
      const critical = check === "phone_usability";
      // Critical in the warning tone, never red; the rest quiet.
      expect(tile.getAttribute("class")!.includes("--warn-bg"), check).toBe(critical);
      expect(tile.classList.contains("text-warning"), check).toBe(critical);
      expect(tile.classList.contains("bg-base-200"), check).toBe(!critical);
      expect(tile.getAttribute("class")!.includes("error"), check).toBe(false);
    }
  });

  it("only the critical card carries the left accent, in the warning tone", () => {
    const cards = everyCard().querySelectorAll('[data-testid="issue"]');
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) {
      const critical = card.getAttribute("data-check") === "phone_usability";
      expect(card.classList.contains("border-l-4"), card.getAttribute("data-check")!).toBe(critical);
      expect(card.getAttribute("class")!.includes("--warn-rule"), card.getAttribute("data-check")!).toBe(critical);
    }
  });

  it("the severity badge carries its signal", () => {
    const root = everyCard();
    const badge = (check: string) => root.querySelector(`[data-check="${check}"] [data-testid="issue-severity"]`)!;
    for (const [check, signal, word] of [
      ["phone_usability", "signal-high", "severity.high"],
      ["slow_pages", "signal-medium", "severity.mid"],
    ] as const) {
      const svg = badge(check).querySelector("svg")!;
      expect(svg.classList.contains(`lucide-${signal}`), check).toBe(true);
      expect(svg.getAttribute("aria-hidden"), check).toBe("true");
      // Legible at 390: 16px, a heavy stroke, in the badge's own text colour.
      expect(svg.classList.contains("size-4"), check).toBe(true);
      expect(Number(svg.getAttribute("stroke-width")), check).toBeGreaterThanOrEqual(2.5);
      expect(svg.getAttribute("stroke"), check).toBe("currentColor");
      expect(svg.getAttribute("class")!.split(/\s+/).some((c) => c.startsWith("text-")), check).toBe(false);
      expect(badge(check).text.trim(), check).toBe(copy(word));
    }
    expect(badge("phone_usability").classList.contains("badge-warning")).toBe(true);
    expect(badge("slow_pages").getAttribute("class")).not.toMatch(/badge-(warning|error)/);
    expect(root.querySelectorAll("svg.lucide-signal-low")).toHaveLength(0);
  });

  it("page links show they open a new tab", () => {
    const links = everyCard().querySelectorAll('a[target="_blank"]');
    expect(links.length).toBe(4);
    for (const link of links) {
      expect(link.querySelector("svg.lucide-external-link")?.getAttribute("aria-hidden"), link.text).toBe("true");
      expect(link.querySelector(".sr-only")?.text.trim(), link.text).toBe(copy("draft.live.new-tab"));
    }
  });
});
