// Billing's "What you got this month", rendered in each state it has.
/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthPanel } from "@/app/(account)/app/settings/panels/MonthPanel";
import type { MonthGot } from "@/lib/account/billing";
import { copy } from "@/lib/presentation/copy";

const PERIOD = { from: new Date("2026-09-07T12:00:00.000Z"), to: new Date("2026-10-07T12:00:00.000Z") };

function rendered(got: MonthGot): Document {
  const html = renderToStaticMarkup(<MonthPanel got={got} timeZone="America/Chicago" />);
  return new DOMParser().parseFromString(html, "text/html");
}

const text = (doc: Document, testId: string): string =>
  doc.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";

describe("a period with pages, refreshes and scans", () => {
  const doc = rendered({
    ...PERIOD,
    live: 12,
    refreshed: 3,
    scans: 4,
    pages: [
      { title: "Water heater repair in Austin", refresh: false, checks: { passed: 21, total: 22 } },
      { title: "Drain cleaning prices", refresh: true, checks: { passed: 22, total: 22 } },
    ],
  });

  it("states the period in the customer's zone and each count", () => {
    expect(doc.body.textContent).toContain(copy("settings.month.period", { from: "Sep 7, 2026", to: "Oct 7, 2026" }));
    expect(text(doc, "billing-month-live")).toBe(`12${copy("settings.month.live")}`);
    expect(text(doc, "billing-month-refreshed")).toBe(`3${copy("settings.month.refreshed")}`);
    expect(text(doc, "billing-month-scans")).toBe(`4${copy("settings.month.scans")}`);
  });

  it("states the checks each page passed", () => {
    const rows = [...doc.querySelectorAll('[data-testid="billing-month-pages"] li')].map((li) => li.textContent);
    expect(rows).toEqual([
      `Water heater repair in Austin${copy("draft.checks.headline", { passed: 21, total: 22 })}`,
      `Drain cleaning prices${copy("settings.month.refresh")}${copy("draft.checks.headline", { passed: 22, total: 22 })}`,
    ]);
  });
});

describe("not measured is never 0", () => {
  const doc = rendered({
    ...PERIOD,
    live: 0,
    refreshed: 0,
    scans: null,
    pages: [{ title: null, refresh: false, checks: null }],
  });

  it("a period with no scans reads not measured, and a true zero stays 0", () => {
    expect(text(doc, "billing-month-scans")).toBe(`${copy("settings.month.not-measured")}${copy("settings.month.scans")}`);
    expect(text(doc, "billing-month-live")).toBe(`0${copy("settings.month.live")}`);
  });

  it("a page whose checks were not recorded reads not measured", () => {
    const row = doc.querySelector('[data-testid="billing-month-pages"] li')?.textContent ?? "";
    expect(row).toBe(`${copy("settings.month.untitled")}${copy("settings.month.not-measured")}`);
    expect(row).not.toMatch(/\d/);
  });
});

it("a period with no pages says so instead of an empty list", () => {
  const doc = rendered({ ...PERIOD, live: 0, refreshed: 0, scans: 1, pages: [] });
  expect(doc.querySelector('[data-testid="billing-month-pages"]')).toBeNull();
  expect(doc.body.textContent).toContain(copy("settings.month.no-pages"));
});
