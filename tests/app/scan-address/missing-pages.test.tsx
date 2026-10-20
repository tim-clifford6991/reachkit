// Owner E1 (2026-10-19): the report lists every page it found missing, and
// tallies each competitor's, from the stored report at 0¢. A count no scan
// builds reads as not measured yet, never as a scan that stopped early.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { unmeasured } from "@/lib/measure/measured";
import { MissingPagesList } from "@/app/(public)/scan/[domain]/_modules/missing-pages";
import { cardsOf, missingPagesOf, type MissingPage } from "@/app/(public)/scan/[domain]/_problems/model";
import { panelReport, renderReport } from "./panel-report";

const htmlText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("every missing page is listed", () => {
  it("a 14-page report renders all 14, the first few open and the rest closed", () => {
    const pages: MissingPage[] = Array.from({ length: 14 }, (_, i) => ({
      search: `search ${i + 1}`,
      volume: 100 + i,
      holder: null,
      firstPage: null,
    }));
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} />);
    expect(html.match(/<li/g)).toHaveLength(14);
    for (const page of pages) expect(html).toContain(`>${page.search}<`);
    const closed = html.slice(html.indexOf("<details"));
    expect(closed).not.toMatch(/<details[^>]*\sopen/);
    expect(closed.match(/<li/g)!.length).toBeGreaterThan(0);
    expect(html.slice(0, html.indexOf("<details")).match(/<li/g)!.length).toBeLessThan(14);
  });

  it.each(["saas", "local"] as const)("the %s panel report lists every page it counted, each with its search", (which) => {
    const report = panelReport(which);
    const html = renderReport(report);
    const pages = missingPagesOf(report)!;
    expect(pages).toHaveLength(report.freePage!.totalPages);
    const list = html.slice(html.indexOf('data-testid="report-missing-pages"'));
    for (const page of pages) expect(list).toContain(`>${htmlText(page.search)}<`);
  });
});

describe("each competitor's tally of the pages the site is missing", () => {
  // Golden: read once from the stored reports, the searches each competitor
  // is on the first page for, among the pages the site is missing.
  it.each([
    ["saas", { "calendly.com": 3, "cloudwell.io": 2, "microsoft.com": 2, "virtosoftware.com": 2 }],
    ["local", { "comfort-air.com": 1, "dmcserviceinc.com": 1, "kesslerplumbingllc.com": 1, "nicksplumbing.com": 1, "allensplumbinghi.com": 0 }],
  ] as const)("the %s panel report shows each competitor row's tally", (which, tallies) => {
    const report = panelReport(which);
    const html = renderReport(report);
    expect(report.presence!.rivals.map((r) => r.domain).sort()).toEqual(Object.keys(tallies).sort());
    for (const [domain, count] of Object.entries(tallies)) {
      expect(html).toContain(htmlText(`${domain} · `));
      expect(html).toMatch(new RegExp(`${domain.replace(/\./g, "\\.")} · \\d+/\\d+ · ${htmlText(copy("presence.rival.pages", { count: String(count) }))}<`));
    }
  });

  it("where the stored report cannot say, a tally is not measured, never 0", () => {
    const stored = panelReport("saas");
    const report = { ...stored, questions: unmeasured<never>("undeterminable", stored.verdict.measuredAt) };
    const html = renderReport(report);
    for (const rival of report.presence!.rivals) {
      expect(html).toContain(htmlText(`${rival.domain} · ${rival.top10Count}/${report.presence!.measuredSearches} · ${copy("presence.rival.pages.unmeasured")}`));
    }
    expect(html).not.toContain(htmlText(copy("presence.rival.pages", { count: "0" })));
  });
});

describe("a count no scan builds says not measured yet", () => {
  it.each(["saas", "local"] as const)("the %s panel report never says the scan stopped early for one", (which) => {
    const report = panelReport(which);
    const html = renderReport(report);
    const unquotable = copy("problem.unquotable-pages.title");
    expect(html).toContain(htmlText(copy("unmeasured.not-yet", { what: unquotable })));
    expect(html).not.toContain(htmlText(copy("unmeasured.not-attempted", { what: unquotable })));
    expect(html).not.toContain(htmlText(copy("unmeasured.not-attempted", { what: copy("problem.missing-pages.title") })));
  });

  it.each(["saas", "local"] as const)("the %s panel report's missing-pages card shows the real count", (which) => {
    const report = panelReport(which);
    const missing = cardsOf(report, []).find((card) => card.problem === "missing_pages")!;
    expect(missing.count).toMatchObject({ kind: "measured", value: report.freePage!.totalPages });
  });

  it("a scan that stopped before its questions still says so", () => {
    const stored = panelReport("local");
    const report = { ...stored, questions: unmeasured<never>("not_attempted", stored.verdict.measuredAt) };
    const html = renderReport(report);
    expect(html).toContain(htmlText(copy("unmeasured.not-attempted", { what: copy("problem.missing-pages.title") })));
  });
});
