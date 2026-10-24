/** @vitest-environment jsdom */
// tests/app/calendar/week.test.tsx — SPEC §7 (E5, 2026-10-19): Plan is the
// committed week as seven day cells, Monday to Sunday in the site's zone,
// each with its page, its state and, where the page can still be stopped,
// the stop control; the spares under it; and a phone lists the same days
// in the same order.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { COPY } from "@/lib/presentation/copy";
import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import { planWeek } from "@/app/(account)/app/calendar/dates";
import { assembleMonth, weekOf, type CalendarFacts, type DraftOnDay } from "@/app/(account)/app/calendar/month";
import { FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH } from "@/app/(account)/app/calendar/fixture";
import { whySentenceOf } from "@/app/(account)/app/calendar/card-lines";
import type { State } from "@/lib/publish/types";
import { shown, withNuqs } from "./nuqs-adapter";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const WEEK = ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"];

const cells = (root: Element): Element[] => [...root.querySelectorAll('[data-testid="calendar-week"] > li')];
const listed = (root: Element): string[] =>
  [...root.querySelectorAll('[data-testid="calendar-list"] [data-testid^="calendar-day-"]')].map((row) =>
    (row.getAttribute("data-testid") ?? "").replace("calendar-day-", "")
  );
const stateOf = (cell: Element | null | undefined): string | null =>
  cell?.querySelector('[data-testid="day-state"]')?.getAttribute("data-state") ?? null;

/** A full week: one page on each of the fixture's seven days, nothing
 *  stopped and nothing held. */
function fullWeek(): CalendarFacts {
  const states: State[] = ["published", "in_review", "approved", "planned", "planned", "planned", "planned"];
  const template = FIXTURE_CALENDAR_FACTS.drafts.find((d) => d.scheduledFor === "2026-09-18")!;
  const drafts: DraftOnDay[] = WEEK.map((day, at) => ({
    ...template,
    draftId: states[at] === "planned" ? null : `draft-${day}`,
    title: `page ${day}`,
    state: states[at]!,
    scheduledFor: day,
    liveUrl: states[at] === "published" ? `https://content.example.com/${day}` : null,
  }));
  return { ...FIXTURE_CALENDAR_FACTS, stop: null, drafts, instructions: {}, stoppedDays: [] };
}

describe("Plan's week is Monday to Sunday in the site's zone", () => {
  it("is seven dates from the Monday of today's week, whatever day today is", () => {
    for (const today of ["2026-10-05", "2026-10-08", "2026-10-11"]) {
      expect(planWeek(today), today).toEqual([
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
        "2026-10-08",
        "2026-10-09",
        "2026-10-10",
        "2026-10-11",
      ]);
    }
  });

  it("a week across a month's end is whole, and a day of the other month still opens", () => {
    const facts = { ...FIXTURE_CALENDAR_FACTS, now: new Date("2026-10-01T14:00:00Z") };
    const october = assembleMonth(facts, "2026-10");
    const week = weekOf([assembleMonth(facts, "2026-09"), october], october.today);
    expect(week.cells.map((cell) => cell.day)).toEqual(planWeek("2026-10-01"));

    const root = render(withNuqs(<CalendarView week={week} />, { day: "2026-09-29" }));
    expect(listed(root)).toEqual(planWeek("2026-10-01"));
    expect(root.querySelector('[data-testid="day-panel"]')?.hasAttribute("data-implicit")).toBe(false);
  });
});

describe("condition 1 — seven cells, each with its page, its state and the stop", () => {
  it("a seven-page week: every day holds its page and its state, Monday first", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(fullWeek(), FIXTURE_MONTH))} />));
    const days = cells(root);
    expect(days.map((cell) => cell.getAttribute("data-testid"))).toEqual(WEEK.map((day) => `calendar-cell-${day}`));
    expect(days.map((cell) => cell.querySelector('[data-testid="cell-label"]')?.textContent)).toEqual(
      WEEK.map((day) => `page ${day}`)
    );
    expect(days.map(stateOf)).toEqual(["live", "written", "written", "planned", "planned", "planned", "planned"]);
    expect(days.map((cell) => cell.querySelector('[data-testid="day-state"]')?.textContent)).toEqual([
      COPY["calendar.stage.live"],
      COPY["calendar.day.written"],
      COPY["calendar.day.written"],
      COPY["calendar.stage.planned"],
      COPY["calendar.stage.planned"],
      COPY["calendar.stage.planned"],
      COPY["calendar.stage.planned"],
    ]);
  });

  it("each page says under 'Why' the sentence for the reason its week stored, on the week and on a phone", () => {
    const reasons = [
      null,
      { points: 6, parts: [{ part: "fit" as const, n: 3 }, { part: "ai_gap" as const, n: 2 }, { part: "linked_by_ai" as const, n: 1 }], rule: "best" as const },
      { points: 3, parts: [{ part: "fit" as const, n: 1 }, { part: "demand" as const, n: 2 }], rule: "best" as const },
      { points: 1, parts: [{ part: "fit" as const, n: 1 }], rule: "best" as const },
    ];
    const facts = fullWeek();
    const drafts = facts.drafts.map((draft, at) => ({ ...draft, whyLine: whySentenceOf(reasons[at % reasons.length]) }));
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth({ ...facts, drafts }, FIXTURE_MONTH))} />));
    const lines = [null, COPY["calendar.reason.ai-gap"], COPY["calendar.reason.searched"], null, null, COPY["calendar.reason.ai-gap"], COPY["calendar.reason.searched"]];
    expect(cells(root).map((cell) => cell.querySelector('[data-testid="cell-why-line"]')?.textContent ?? null)).toEqual(lines);
    const rows = [...root.querySelectorAll('[data-testid="calendar-list"] [data-testid^="calendar-day-"]')];
    expect(rows.map((row) => row.querySelector('[data-testid="list-why-line"]')?.textContent ?? null)).toEqual(lines);
    const eyebrows = cells(root).map((cell) => cell.querySelector('[data-testid="cell-why"]')?.firstElementChild?.textContent ?? null);
    expect(eyebrows).toEqual(lines.map((line) => (line === null ? null : COPY["calendar.week.why"])));
  });

  it("the stop is a ghost warning button, on a written page that can still be stopped and nowhere else", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(fullWeek(), FIXTURE_MONTH))} />));
    const stops = cells(root).map((cell) => cell.querySelector('[data-testid="cell-stop"]'));
    // In review can be stopped; live, approved and a planned day with no
    // draft yet cannot.
    expect(stops.map((stop) => stop !== null)).toEqual([false, true, false, false, false, false, false]);
    const stop = stops[1]!;
    expect(stop.tagName).toBe("BUTTON");
    expect(stop.className.split(" ")).toEqual(expect.arrayContaining(["btn", "btn-ghost", "btn-warning"]));
    expect(stop.textContent).toBe(COPY["calendar.week.stop"]);
  });

  it("the short week: six pages, a day stopped and a day skipped, each said in its own word", () => {
    // The fixture week: a live page, three written, one planned, a day an
    // instruction stopped and a day supply left empty.
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH))} />));
    const days = cells(root);
    expect(days).toHaveLength(7);
    expect(days.map(stateOf)).toEqual(["live", "written", "written", "written", "planned", "stopped", "skipped"]);
    expect(days[5]?.querySelector('[data-testid="cell-label"]')).toBeNull();
    expect(days[6]?.className).toContain("border-dashed");
  });

  it("a page someone stopped is a stopped day, and its topic is gone", () => {
    const facts = fullWeek();
    const drafts = facts.drafts.map((d) => (d.scheduledFor === "2026-09-15" ? { ...d, state: "skipped" as const } : d));
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth({ ...facts, drafts }, FIXTURE_MONTH))} />));
    const day = root.querySelector('[data-testid="calendar-cell-2026-09-15"]');
    expect(stateOf(day)).toBe("stopped");
    expect(day?.querySelector('[data-testid="cell-label"]')).toBeNull();
  });

  it("the spares are listed under the week, and absent when there are none", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH))} />));
    expect([...root.querySelectorAll('[data-testid="calendar-spare"]')].map((li) => li.textContent)).toEqual(
      FIXTURE_CALENDAR_FACTS.spares
    );
    const none = render(
      withNuqs(<CalendarView {...shown(assembleMonth({ ...FIXTURE_CALENDAR_FACTS, spares: [] }, FIXTURE_MONTH))} />)
    );
    expect(none.querySelector('[data-testid="calendar-spares"]')).toBeNull();
  });

  it("the filter and the numbers count the week the screen shows", () => {
    const { week } = shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH));
    const root = render(withNuqs(<CalendarView week={week} />));
    expect(root.querySelector('[data-testid="stage-count-all"]')?.textContent).toBe(
      String(week.cells.filter((cell) => cell.page !== null).length)
    );
  });
});

describe("condition 3 — a phone lists the same days in the same order", () => {
  it("the list and the cells are the same seven dates, Monday first", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH))} />));
    expect(listed(root)).toEqual(WEEK);
    expect(cells(root).map((cell) => cell.getAttribute("data-testid")?.replace("calendar-cell-", ""))).toEqual(WEEK);
    // Each row says the same state its cell does.
    const rows = [...root.querySelectorAll('[data-testid="calendar-list"] [data-testid^="calendar-day-"]')];
    expect(rows.map(stateOf)).toEqual(cells(root).map(stateOf));
  });
});
