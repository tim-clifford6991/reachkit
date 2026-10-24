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
const committedRows = (html: string) => (weekTable(html).match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr/g) ?? []).length;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("a site with a committed week", () => {
  const saas = site("savvycal.com");
  const html = render([saas]);

  it("shows the committed 7 and the spares, each with its points and rule", () => {
    expect(committedRows(html)).toBe(saas.week.committed.length);
    expect(saas.week.committed.filter((row) => row.day === null).length).toBeGreaterThan(0);
    expect(html).toContain(`>${copy("review.spare")}<`);
    for (const row of saas.week.committed) {
      expect(html).toContain(row.search!);
      expect(html).toContain(row.rule!.replaceAll("&", "&amp;"));
    }
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
    expect(text(summary).trim()).toBe(`${title} ${copy("review.rejected.lead")}`);
    for (const row of saas.week.rejected) expect(text(html)).toContain(`${row.search!} : ${row.reason}`);
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
