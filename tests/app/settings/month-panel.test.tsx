// Billing's "What you got this month" (board SettingsBilling), rendered in each state it has.
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
  today: "2026-10-20",
  price: "€49",
  host: "help.harborplumbing.example",
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

describe("a period with pages, Monday mails and a finished pass", () => {
  const doc = rendered(GOT);

  it("states the period and that everything is in the price, with the way to every page", () => {
    expect(doc.body.textContent).toContain("Billing period Wed, Oct 7, 2026 to Sat, Nov 7, 2026. Everything is included in €49.");
    const all = [...doc.querySelectorAll("a")].find((a) => a.textContent === "See every page →");
    expect(all?.getAttribute("href")).toBe("/app/calendar");
  });

  it("draws the four tiles in the board's order and words", () => {
    expect([...doc.querySelectorAll("ul > li[data-testid]")].map((li) => li.getAttribute("data-testid"))).toEqual([
      "billing-month-live",
      "billing-month-reports",
      "billing-month-asked",
      "billing-month-planned",
    ]);
    expect(text(doc, "billing-month-live")).toBe("2 pages went live on help.harborplumbing.example");
    expect(text(doc, "billing-month-reports")).toBe("2 Monday reports Oct 12 and Oct 19");
    expect(text(doc, "billing-month-asked")).toBe("35 searches and AI questions 12 searches and 23 AI questions, checked each week");
    expect(text(doc, "billing-month-planned")).toBe("3 pages planned this week up to 7 a week, never filler");
  });

  it("draws the period bar with its ends, today and the legend", () => {
    const bar = doc.querySelector('[data-testid="billing-month-bar"]')!;
    expect(bar.getAttribute("aria-label")).toBe(
      "This billing period, Wed, Oct 7, 2026 to Sat, Nov 7, 2026: 2 pages live so far, 3 planned this week"
    );
    expect(bar.textContent).toContain("Today");
    expect(bar.textContent).toContain("A page went live");
    expect(bar.textContent).toContain("Planned this week");
    expect(bar.querySelectorAll("span[aria-hidden].bg-success.h-3")).toHaveLength(2);
    expect(bar.querySelectorAll("span[aria-hidden].bg-primary.h-3")).toHaveLength(3);
  });

  it("keeps the detail behind Show the detail, pointing to Overview", () => {
    const detail = doc.querySelector('details[data-testid="billing-month-detail"]')!;
    expect(detail.querySelector("summary")?.textContent).toBe("Show the detail");
    expect(detail.textContent).toContain(copy("settings.month.note"));
    expect(detail.querySelector("a")?.getAttribute("href")).toBe("/app");
  });
});

describe("not measured is never 0", () => {
  const doc = rendered({ ...GOT, live: 0, liveAt: [], reports: [], asked: null }, { planned: null, first: "Tue, Oct 20, 4:00 PM" });

  it("an unread pass and an unread plan say not measured, and true zeros stay quiet zeros", () => {
    expect(text(doc, "billing-month-asked")).toBe(`${copy("settings.month.not-measured")} searches and AI questions`);
    expect(text(doc, "billing-month-planned")).toBe(`${copy("settings.month.not-measured")} pages planned this week up to 7 a week, never filler`);
    expect(text(doc, "billing-month-live")).toBe("0 pages went live on help.harborplumbing.example");
    expect(doc.querySelector('[data-testid="billing-month-reports"] .figure')?.className).toContain("text-base-content/70");
  });

  it("AI questions not measured: the searches are counted and the questions named in words, never 0", () => {
    const unmeasured = rendered({ ...GOT, asked: { searches: 5, questions: null } });
    expect(text(unmeasured, "billing-month-asked")).toBe(
      "5 searches and AI questions 5 searches, checked each week. AI questions were not measured this pass."
    );
    expect(unmeasured.body.textContent).not.toMatch(/\b0 AI questions/);
  });

  it("in the first week it says when the first page goes live", () => {
    expect(text(doc, "billing-month-first")).toBe("Your first page goes live Tue, Oct 20, 4:00 PM.");
    expect(rendered(GOT, { first: "Tue, Oct 20, 4:00 PM" }).querySelector('[data-testid="billing-month-first"]')).toBeNull();
  });
});

it("a month that could not be read says so, with no figure", () => {
  const doc = rendered(null);
  expect(text(doc, "billing-month-unread")).toBe(copy("settings.month.unread"));
  expect(doc.querySelector('[data-testid="billing-month-live"]')).toBeNull();
  expect(doc.body.textContent).not.toMatch(/\d/);
});

it("month tiles carry their icons in board order, and an unmeasured figure still shows its words", () => {
  const icons = (doc: Document) =>
    [...doc.querySelectorAll("ul > li[data-testid]")].map((li) => [...(li.querySelector(":scope > svg")?.classList ?? [])].find((c) => c.startsWith("lucide-")));
  expect(icons(rendered(GOT))).toEqual(["lucide-file-text", "lucide-inbox", "lucide-search", "lucide-calendar"]);
  const unread = rendered({ ...GOT, asked: null }, { planned: null });
  expect(icons(unread)).toEqual(["lucide-file-text", "lucide-inbox", "lucide-search", "lucide-calendar"]);
  expect(text(unread, "billing-month-asked")).toContain(copy("settings.month.not-measured"));
  expect(text(unread, "billing-month-asked")).not.toMatch(/^0\b/);
});
