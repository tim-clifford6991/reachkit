/** @vitest-environment jsdom */
// tests/app/calendar/week.test.tsx — SPEC §7 (2026-10-08, issue 1340): on a
// phone Plan is the recent days and the days ahead, not a month.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import { planHorizonEnd, planWeek } from "@/app/(account)/app/calendar/dates";
import { assembleMonth, weekOf } from "@/app/(account)/app/calendar/month";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH } from "@/app/(account)/app/calendar/fixture";
import { shown, withNuqs } from "./nuqs-adapter";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const listed = (root: Element): string[] =>
  [...root.querySelectorAll('[data-testid="calendar-list"] [data-testid^="calendar-day-"]')].map((row) =>
    (row.getAttribute("data-testid") ?? "").replace("calendar-day-", "")
  );

describe("the week a phone lists", () => {
  it("is Monday of today's week through the plan horizon, whichever day today is", () => {
    const week = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
    // A Thursday, the Monday itself, and the Sunday the horizon ends on.
    for (const today of ["2026-10-08", "2026-10-05", "2026-10-11"]) {
      expect(planWeek(today), today).toEqual(week);
      expect(planWeek(today).at(-1), today).toBe(planHorizonEnd(today));
    }
  });

  it("the list holds those days and no others, while the month keeps every date", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    const root = render(withNuqs(<CalendarView {...shown(model)} />));
    expect(listed(root)).toEqual(planWeek(model.today));
    expect(root.querySelectorAll('[data-testid^="calendar-cell-2026-09-"]')).toHaveLength(30);
    // Each chip counts what its shape shows: the month's pages and the week's.
    expect(root.querySelector('[data-testid="stage-count-all"]')?.textContent).toBe(String(model.counts.all));
    const inWeek = model.cells.filter((cell) => cell.page !== null && planWeek(model.today).includes(cell.day));
    expect(root.querySelector('[data-testid="stage-week-count-all"]')?.textContent).toBe(String(inWeek.length));
    expect(inWeek.length).toBeLessThan(model.counts.all);
  });

  it("a week across a month's end is whole, and a day of the other month still opens", () => {
    // Thursday 1 October: the week began on Monday 28 September.
    const facts = { ...FIXTURE_CALENDAR_FACTS, now: new Date("2026-10-01T14:00:00Z") };
    const october = assembleMonth(facts, "2026-10");
    const week = weekOf([assembleMonth(facts, "2026-09"), october], october.today);
    expect(week.cells.map((cell) => cell.day)).toEqual(planWeek("2026-10-01"));

    const root = render(withNuqs(<CalendarView model={october} week={week} />, { day: "2026-09-29" }));
    expect(listed(root)).toEqual(planWeek("2026-10-01"));
    expect(root.querySelector('[data-testid="calendar-day-2026-09-29"]')?.getAttribute("aria-current")).toBe("date");
    const panel = root.querySelector('[data-testid="day-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.hasAttribute("data-implicit")).toBe(false);
  });
});
