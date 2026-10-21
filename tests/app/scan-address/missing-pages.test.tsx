// Owner E1 (2026-10-19): the report lists every page it found missing, from
// the stored report at 0¢. A count no scan
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
  it("a 14-page report renders all 14 open, under the line that says none is hidden", () => {
    const pages: MissingPage[] = Array.from({ length: 14 }, (_, i) => ({
      search: `search ${i + 1}`,
      volume: 100 + i,
      holder: null,
    }));
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} />);
    expect(html).not.toContain("<details");
    const open = html.slice(html.indexOf("<ol"), html.indexOf("</ol>"));
    expect(open.match(/<li/g)).toHaveLength(14);
    for (const page of pages) expect(open).toContain(`>${page.search}<`);
    expect(html.indexOf(`>${htmlText(copy("report.missing.all", { count: "14" }))}</p>`)).toBeGreaterThan(html.indexOf("</ol>"));
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

describe("the section is named and says what each page is", () => {
  it.each(["saas", "local"] as const)("the %s panel report names the section above its heading and leads the list", (which) => {
    const report = panelReport(which);
    const html = renderReport(report);
    const heading = copy("report.offer.found", { count: String(report.freePage!.totalPages) });
    const eyebrow = html.indexOf(`>${htmlText(copy("report.missing.eyebrow"))}</p>`);
    const h2 = html.indexOf(`>${heading}</h2>`);
    const lead = html.indexOf(`>${htmlText(copy("report.missing.lead"))}</p>`);
    const list = html.indexOf("<li", html.indexOf('data-testid="report-missing-pages"'));
    expect(eyebrow).toBeGreaterThan(-1);
    expect(eyebrow).toBeLessThan(h2);
    expect(h2).toBeLessThan(lead);
    expect(lead).toBeLessThan(list);
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
