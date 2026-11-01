// Owner E1 (2026-10-19): the report lists every page it found missing, from
// the stored report at 0¢. A count no scan
// builds reads as not measured yet, never as a scan that stopped early.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, type HTMLElement } from "node-html-parser";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { fromStored } from "@/lib/presentation/generated";
import { unmeasured } from "@/lib/measure/measured";
import { MissingPagesList } from "@/app/(public)/scan/[domain]/_modules/missing-pages";
import { FIXTURE_REPORT } from "@/app/(public)/scan/[domain]/_fixture/states";
import { cardsOf, missingPagesOf, type MissingPage } from "@/app/(public)/scan/[domain]/_problems/model";
import { panelReport, renderReport } from "./panel-report";

const htmlText = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("every missing page is listed", () => {
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
  it.each(["saas", "local"] as const)("the %s panel report heads the section by its name, then the lead and the list", (which) => {
    const html = renderReport(panelReport(which));
    const h2 = html.indexOf(`>${htmlText(copy("report.missing.title"))}</h2>`);
    const lead = html.indexOf(`>${htmlText(copy("report.missing.lead"))}</p>`);
    const list = html.indexOf("<li", html.indexOf('data-testid="report-missing-pages"'));
    expect(h2).toBeGreaterThan(-1);
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
    question: null,
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

  it("says the count once, in the headline, and lists the free page's row first", () => {
    const html = renderReport(FIXTURE_REPORT);
    const list = html.slice(html.indexOf('data-testid="report-missing-pages"'));
    expect(html).toContain(`>${htmlText(copy("report.top.offer", { count: "7" }))}</a>`);
    const first = list.slice(list.indexOf("<li"), list.indexOf("</li>"));
    expect(first).toContain(htmlText(FIXTURE_REPORT.freePage!.target.keyword));
    expect(first).toContain(htmlText(copy("report.missing.free")));
  });
});

describe("pages 1 to 5 are cards, the rest dashed rows (2026-10-24 E16)", () => {
  const listed = (count: number): MissingPage[] =>
    Array.from({ length: count }, (_, i) => ({ search: `search ${i + 1}`, volume: 100 + i, holder: "rival.example.net", question: null }));
  const draw = (pages: readonly MissingPage[], freeSearch: string | null = null): HTMLElement =>
    parse(renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch={freeSearch} />));
  const cards = (root: HTMLElement): HTMLElement[] => root.querySelectorAll("li.card");
  const rows = (root: HTMLElement): HTMLElement[] => root.querySelectorAll("li.border-dashed");
  const text = (el: HTMLElement): string => el.textContent.replace(/\s+/g, " ").trim();

  it("14 pages draw 5 cards and 9 rows", () => {
    const root = draw(listed(14));
    const [first, second] = root.querySelectorAll("ol");
    expect(first!.getAttribute("role")).toBe("list");
    expect(cards(first!)).toHaveLength(5);
    cards(first!).forEach((card, i) => {
      expect(card.querySelector("span.num")!.textContent).toBe(copy("report.missing.page", { n: String(i + 1) }));
      expect(card.querySelector("[aria-hidden] svg.lucide-file-text")).not.toBeNull();
      expect(text(card)).toContain(`search ${i + 1}`);
    });
    expect(second!.getAttribute("start")).toBe("6");
    expect(second!.getAttribute("role")).toBe("list");
    expect(rows(second!)).toHaveLength(9);
    rows(second!).forEach((row, i) => {
      expect(row.querySelector("span.num")!.textContent).toBe(String(i + 6));
      expect(row.querySelector('svg.lucide-file-text[aria-hidden="true"]')).not.toBeNull();
      expect(row.querySelector(".font-mono")!.textContent).toBe(`search ${i + 6}`);
    });
    expect(text(root)).toContain(copy("report.missing.all.rest", { count: "14" }));
  });

  it("3 pages draw 3 cards and no rows", () => {
    const root = draw(listed(3));
    expect(root.querySelectorAll("ol")).toHaveLength(1);
    expect(cards(root)).toHaveLength(3);
    expect(rows(root)).toHaveLength(0);
    expect(text(root)).toContain(copy("report.missing.all", { count: "3" }));
    expect(text(root)).not.toContain("Pages 6 to");
  });

  it("the tally names the rows: none for 1, the six line for 6", () => {
    expect(text(draw(listed(1)))).not.toContain(copy("report.missing.all", { count: "1" }));
    const six = draw(listed(6));
    expect(rows(six)).toHaveLength(1);
    expect(text(six)).toContain(copy("report.missing.all.six"));
    expect(text(six)).not.toContain("Pages 6 to");
  });

  it("only the free card is outlined and linked", () => {
    const root = draw(listed(14), "search 9");
    const [first] = cards(root);
    expect(root.querySelectorAll(".border-primary")).toEqual([first]);
    expect(root.querySelectorAll('a[href="#first-page"]')).toHaveLength(1);
    expect(first!.querySelector('a[href="#first-page"]')).not.toBeNull();
    expect(root.querySelectorAll(".badge")).toHaveLength(1);
    expect(first!.querySelector(".badge svg.lucide-gift")).not.toBeNull();
    expect(text(first!)).toContain("search 9");
    expect(first!.querySelector(".bg-primary\\/10")).not.toBeNull();
  });

  it("headline is the stored wording, else the search", () => {
    const wording = "Which tool tracks activation without code?";
    const pages: MissingPage[] = [
      { search: "track activation", volume: 300, holder: null, question: fromStored("questions.wording", wording) },
      { search: "amplitude alternative", volume: 200, holder: null, question: null },
    ];
    const [asked, plain] = cards(draw(pages));
    expect(asked!.querySelector(".font-semibold")!.textContent).toBe(wording);
    expect(text(asked!)).toContain("track activation");
    expect(plain!.querySelector(".font-semibold")!.textContent).toBe("amplitude alternative");
  });

  it("the holder sits in mono inside its sentence", () => {
    const [card] = cards(draw(listed(1)));
    expect(card!.querySelector(".font-mono.break-all")!.textContent).toBe("rival.example.net");
    expect(text(card!)).toContain(copy("report.missing.holder", { holder: "rival.example.net" }));
  });
});

describe("no business holds a search the report counts as missing, and nothing says one does", () => {
  it("a stored free page that names a platform names who the missing pages say holds its search instead", () => {
    const stored = panelReport("local");
    const report = { ...stored, freePage: { ...stored.freePage!, beats: "google.com" } };
    const html = renderReport(report);
    const card = html.slice(html.indexOf('id="first-page"'));
    const holder = missingPagesOf(report)!.find((page) => page.search === report.freePage.target.keyword)!.holder;
    expect(card).not.toContain(">google.com<");
    expect(card).toContain(holder === null ? htmlText(copy("place.report.first-page.rival")) : `>${holder}<`);
  });

  it("pages with no holder carry no holder line, and the lead claims no competitor", () => {
    const pages: MissingPage[] = ["first search", "second search"].map((search) => ({ search, volume: 100, holder: null, question: null }));
    const html = renderToStaticMarkup(<MissingPagesList pages={pages} freeSearch={null} />);
    expect(html).not.toContain(htmlText(copy("report.missing.holder", { holder: "" }).trim()));
    expect(parse(html).textContent.toLowerCase()).not.toContain("competitor");
  });
});
