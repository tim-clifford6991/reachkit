// The owner's review screen, drawn from stored rows in the board's sections:
// a committed week with its spares and the rows held back, a site with no
// commit, and each live page's label, where a page never read says "not
// measured" and never 0. Nothing on it posts. 0¢.
import "../../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Review } from "@/app/(account)/app/review/Review";
import type { ReviewSite } from "@/app/(account)/app/review/store";
import { reviewWeek, storedChoice } from "@/lib/opportunities/review/week";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { panelSite } from "../../golden/plan/panel";
import { storedRows } from "./stored";

function site(domain: string, rows = storedRows(domain), pages: ReviewSite["pages"] = []): ReviewSite {
  return { id: domain, domain, week: reviewWeek(rows, storedChoice(rows)), pages };
}

const render = (sites: readonly ReviewSite[] | null) => renderToStaticMarkup(React.createElement(Review, { sites }));

/** The committed week's table. */
const weekTable = (html: string) => html.split('data-testid="review-week"')[1]?.split("</table>")[0] ?? "";
const committedRows = (html: string) => (weekTable(html).match(/<tbody[^>]*>[\s\S]*<\/tbody>/)?.[0].match(/<tr/g) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("a site with a committed week", () => {
  const saas = site("savvycal.com");
  const html = render([saas]);

  it("shows the committed 7 and the spares, each by its title and search, as the board draws a row", () => {
    expect(committedRows(html)).toBe(saas.week.committed.length);
    expect(saas.week.committed.filter((row) => row.day === null).length).toBeGreaterThan(0);
    expect(html).toContain(`>${copy("review.spare")}<`);
    for (const row of saas.week.committed) {
      expect(html).toContain(row.search!);
      if (row.title !== null) expect(html).toContain(`<strong>${row.title.replaceAll("&", "&amp;")}</strong>`);
      // The store's internal type and the placing rule stay in reviewWeek, off the screen.
      expect(html).not.toContain(`>${row.type}<`);
      if (row.rule !== null) expect(html).not.toContain(row.rule.replaceAll("&", "&amp;"));
    }
    const [first, ...rest] = saas.week.committed;
    const titled = render([{ ...saas, week: { ...saas.week, committed: [{ ...first!, title: "Toilet repair in Austin" }, ...rest] } }]);
    expect(text(weekTable(titled))).toContain("Toilet repair in Austin");
    expect(html).not.toMatch(/Placed by|Fit [\d—]/);
    expect(html).not.toContain(copy("review.week.empty"));
  });

  it("reads under the week it starts, in the board's columns, with each page's type and the customer's why", () => {
    expect(html).toContain(copy("review.eyebrow.week", { date: "19 October" }));
    const heads = [...weekTable(html).matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual((["review.col.day", "review.col.page", "review.col.search", "review.col.points", "review.col.why"] as const satisfies readonly CopyKey[]).map((key) => copy(key)));
    const body = text(weekTable(html));
    expect(body).toContain(" Mon ");
    expect(body).toContain(copy("review.page.new", { type: copy("review.page.listicle") }));
    expect(body).toContain(`${copy("review.part.fit")} 3`);
    expect(body).toContain(copy("calendar.week.why.fit"));
  });

  it("shows each row held back with its stored reason", () => {
    expect(saas.week.rejected.length).toBeGreaterThan(0);
    const title = copy("review.rejected.title", { count: String(saas.week.rejected.length) });
    const summary = html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? "";
    expect(summary).not.toMatch(/<(p|div)[\s>]/);
    expect(text(summary).trim()).toBe(title);
    expect(title).toBe(`Not chosen (${saas.week.rejected.length}), and why`);
    for (const row of saas.week.rejected) expect(text(html)).toContain(`${row.search!} : ${row.reason}`);
  });
});

describe("the board's cuts and its 390 shape", () => {
  const html = render([site("savvycal.com")]);

  it("Not chosen is a primary link whose chevron leads, and a checked tab is primary", () => {
    const summary = html.match(/<summary class="([^"]*)"[^>]*>([\s\S]*?)<\/summary>/)!;
    expect(summary[1]).toContain("link-primary");
    expect(summary[2]).toMatch(/^<svg[^>]*lucide-chevron-down/);
    const tabs = html.match(/<label class="tab [^"]*"/g)!;
    expect(tabs).toHaveLength(2);
    for (const tab of tabs) {
      expect(tab).toContain("has-checked:text-primary!");
      expect(tab).toContain("has-checked:border-current!");
    }
  });

  it("the title takes the board's h1 step at every width", () => {
    expect(html).toMatch(/<h1 class="text-\(length:--h1\)">/);
  });

  it("heads the why column Why, with no caption saying who reads it", () => {
    expect(copy("review.col.why")).toBe("Why");
    expect(html).not.toContain("as the customer reads it");
  });

  it("each row stacks below sm, and from sm the Page column keeps a minimum width", () => {
    expect(weekTable(html)).toMatch(/<thead class="[^"]*max-sm:hidden/);
    const pages = [...weekTable(html).matchAll(/<td class="([^"]*)" data-testid="review-page"/g)].map((m) => m[1]!);
    expect(pages).toHaveLength(committedRows(html));
    for (const cls of pages) expect(cls).toMatch(/\bsm:min-w-\d+/);
    expect(html).toMatch(/<tr class="max-sm:block max-sm:border-b/);
  });
});

describe("a site with no committed week", () => {
  it('says "No week committed yet", not an empty table', () => {
    const rows = panelSite("austinplumbery.com").rows;
    const html = render([site("austinplumbery.com", rows)]);
    expect(html).toContain(copy("review.week.empty"));
    expect(html).not.toContain('data-testid="review-week"');
    expect(html).toContain(copy("review.eyebrow"));
    expect(html).not.toContain(copy("review.eyebrow.week", { date: "" }));
  });
});

describe("each live page's label", () => {
  const pages: ReviewSite["pages"] = [
    { id: "p1", url: "https://content.savvycal.com/acuity-alternatives", label: "working" },
    { id: "p2", url: "https://content.savvycal.com/never-read", label: null },
  ];
  const html = render([site("savvycal.com", undefined, pages)]);
  const pageList = html.split('data-testid="review-tab-pages"')[1]!;

  it("reads its stored label, and a page with no reading reads not measured, never 0", () => {
    expect(pageList).toContain(copy("review.label.working"));
    expect(pageList).toContain(copy("review.label.unmeasured"));
    expect(pageList).not.toMatch(/>0</);
  });
});

describe("nothing on the screen writes", () => {
  it("there is no form and no button", () => {
    const html = render([site("savvycal.com", undefined, [{ id: "p", url: "https://x.example/a", label: "too_early" }])]);
    expect(html).not.toMatch(/<form|<button|formaction|type="submit"/i);
  });
});

describe("the screen's other states", () => {
  it("no paying site, and sites that could not be read", () => {
    expect(render([])).toContain(copy("review.no-sites"));
    expect(render(null)).toContain(copy("review.unreadable"));
  });
});
