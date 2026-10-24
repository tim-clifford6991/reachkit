// Owner E1 (2026-10-19): the report lists every page it found missing, from
// the stored report at 0¢. A count no scan
// builds reads as not measured yet, never as a scan that stopped early.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { unmeasured } from "@/lib/measure/measured";
import { MissingPagesList } from "@/app/(public)/scan/[domain]/_modules/missing-pages";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
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
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch={null} />);
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

describe("the page the report writes free is marked in the list", () => {
  const pages: MissingPage[] = ["first search", "second search", "free search", "fourth search"].map((search, i) => ({
    search,
    volume: 500 - i * 100,
    holder: "rival.example.net",
  }));
  const free = htmlText(copy("report.missing.free"));
  const read = htmlText(copy("report.missing.free.read"));
  const order = (html: string): string[] => [...html.matchAll(/<li[^>]*>.*?>([a-z ]+ search)</g)].map((m) => m[1]!);

  it("draws the free search first, marked free, with a link to the free page", () => {
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch="free search" />);
    expect(order(html)).toEqual(["free search", "first search", "second search", "fourth search"]);
    const rows = html.split("<li").slice(1);
    expect(rows[0]).toContain(free);
    expect(rows[0]).toContain(`<a href="#first-page"`);
    expect(rows[0]).toContain(`>${read}</a>`);
    for (const row of rows.slice(1)) {
      expect(row).not.toContain(free);
      expect(row).not.toContain(read);
    }
  });

  it("marks nothing and keeps the order where the report offers no free page", () => {
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch={null} />);
    expect(order(html)).toEqual(pages.map((page) => page.search));
    expect(html).not.toContain(free);
    expect(html).not.toContain(read);
  });

  it("marks nothing where the free page's search is not in the list", () => {
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch="another search" />);
    expect(order(html)).toEqual(pages.map((page) => page.search));
    expect(html).not.toContain(free);
    expect(html).not.toContain(read);
  });
});

describe("the example.com fixture draws its missing pages", () => {
  it("lists the seven pages it counts, the free page's search among them", () => {
    const pages = missingPagesOf(FIXTURE_REPORT)!;
    expect(pages).toHaveLength(7);
    expect(pages.map((page) => page.search)).toContain(FIXTURE_REPORT.freePage!.target.keyword);
    for (const page of pages) {
      expect(page.search).not.toBe("");
      expect(page.volume).not.toBeNull();
    }
    expect(pages.some((page) => page.holder !== null)).toBe(true);
  });

  it("renders the list under its count, the free page's row first", () => {
    const html = renderReport(FIXTURE_REPORT);
    const list = html.slice(html.indexOf('data-testid="report-missing-pages"'));
    expect(html).toContain(`>${htmlText(copy("report.offer.found", { count: "7" }))}</h2>`);
    const first = list.slice(list.indexOf("<li"), list.indexOf("</li>"));
    expect(first).toContain(htmlText(FIXTURE_REPORT.freePage!.target.keyword));
    expect(first).toContain(htmlText(copy("report.missing.free")));
  });
});
