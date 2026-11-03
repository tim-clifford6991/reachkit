// Billing's "This month" (board SettingsAccount), rendered in each state it has.
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthPanel, type MonthContext } from "@/app/(account)/app/settings/panels/MonthPanel";
import type { MonthGot } from "@/lib/account/billing";
import { copy } from "@/lib/presentation/copy";

const GOT: MonthGot = {
  from: new Date("2026-10-07T12:00:00.000Z"),
  to: new Date("2026-11-07T12:00:00.000Z"),
  live: 2,
  liveAt: [new Date("2026-10-12T21:00:00.000Z"), new Date("2026-10-13T21:00:00.000Z")],
  reports: [new Date("2026-10-12T13:00:00.000Z"), new Date("2026-10-19T13:00:00.000Z")],
  asked: { searches: 12, questions: 23 },
};
const CONTEXT: MonthContext = {
  timeZone: "America/Chicago",
  price: "€49",
  planned: ["2026-10-21", "2026-10-22", "2026-10-23"],
  first: null,
};

function rendered(got: MonthGot | null, context: Partial<MonthContext> = {}): Document {
  const html = renderToStaticMarkup(<MonthPanel got={got} context={{ ...CONTEXT, ...context }} />);
  return new DOMParser().parseFromString(html, "text/html");
}

/** An element's text nodes, word-separated as a reader hears them. */
const textOf = (el: Element | null | undefined): string => {
  if (!el) return "";
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) parts.push(node.textContent ?? "");
  return parts.map((part) => part.trim()).filter(Boolean).join(" ").replace(/ ([,.;:!?])/g, "$1");
};
const text = (doc: Document, testId: string): string => textOf(doc.querySelector(`[data-testid="${testId}"]`));

const tiles = (doc: Document): string[] => [...doc.querySelectorAll("ul > li[data-testid]")].map(textOf);

describe("a period with pages, Monday mails and a finished pass", () => {
  const doc = rendered(GOT);

  it("states the period, its ends in mono, and that everything is in the price", () => {
    expect(text(doc, "billing-month-period")).toBe("7 Oct to 7 Nov. All included in €49.");
    expect([...doc.querySelectorAll('[data-testid="billing-month-period"] .num')].map(textOf)).toEqual(["7 Oct", "7 Nov"]);
  });

  it("the period's ends are the site's own days: a period that turns at midnight UTC reads a day earlier in Chicago", () => {
    const midnight = { ...GOT, from: new Date("2026-10-07T00:00:00.000Z"), to: new Date("2026-11-07T00:00:00.000Z") };
    expect(text(rendered(midnight), "billing-month-period")).toBe("6 Oct to 6 Nov. All included in €49.");
    expect(text(rendered(midnight, { timeZone: "Europe/London" }), "billing-month-period")).toBe("7 Oct to 7 Nov. All included in €49.");
  });

  it("draws the four tiles in the board's order and words, a figure and what it counts, no icon", () => {
    expect(tiles(doc)).toEqual(["2 pages went live", "2 Monday mails", "35 searches and AI questions checked", "3 pages planned this week"]);
    expect(doc.querySelectorAll("ul svg")).toHaveLength(0);
  });
});

describe("not measured is never 0", () => {
  const doc = rendered({ ...GOT, live: 0, liveAt: [], reports: [], asked: null }, { planned: null, first: "Tue 20 Oct · 4:00 PM" });

  it("an unread pass and an unread plan say not checked, and true zeros stay quiet zeros", () => {
    expect(tiles(doc)).toEqual(["0 pages went live", "0 Monday mails", "not checked searches and AI questions checked", "not checked pages planned this week"]);
    expect(doc.querySelector('[data-testid="billing-month-reports"] .figure')?.className).toContain("text-base-content/70");
  });

  it("AI questions not measured: the searches are counted and the questions named in words, never 0", () => {
    const unmeasured = rendered({ ...GOT, asked: { searches: 5, questions: null } });
    expect(text(unmeasured, "billing-month-asked")).toBe(
      "5 searches and AI questions checked 5 searches, checked each week. AI questions weren’t checked this time."
    );
    expect(unmeasured.body.textContent).not.toMatch(/\b0 AI questions/);
  });

  it("in the first week it says when the first page goes live", () => {
    expect(text(doc, "billing-month-first")).toBe("Your first page goes live Tue 20 Oct · 4:00 PM.");
    expect(rendered(GOT, { first: "Tue 20 Oct · 4:00 PM" }).querySelector('[data-testid="billing-month-first"]')).toBeNull();
  });
});

it("a month that could not be read says so, with no figure", () => {
  const doc = rendered(null);
  expect(text(doc, "billing-month-unread")).toBe(copy("settings.month.unread"));
  expect(doc.querySelector('[data-testid="billing-month-live"]')).toBeNull();
  expect(doc.body.textContent).not.toMatch(/\d/);
});
