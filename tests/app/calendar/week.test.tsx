/** @vitest-environment jsdom */
// tests/app/calendar/week.test.tsx — SPEC §7 (E5, 2026-10-19): Plan is the
// committed week as seven day rows, Monday to Sunday in the site's zone,
// each with its page, its state and, where the page can still be stopped,
// the stop control; and the spares under it.
import { ALL_ARMS } from "./arms";
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
const listed = (root: Element): string[] => cells(root).map((row) => (row.getAttribute("data-testid") ?? "").replace("calendar-cell-", ""));
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

  it("each page says after 'Why' the sentence for the reason its week stored", () => {
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
    // A live page, three written, one planned, a day an instruction stopped and a day supply left empty.
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(ALL_ARMS, FIXTURE_MONTH))} />));
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

});

describe("owner O7 — a page set aside is told plainly, and only a critical cause says Needs you", () => {
  const withDay = (day: string, over: Partial<DraftOnDay>): CalendarFacts => {
    const facts = fullWeek();
    return { ...facts, drafts: facts.drafts.map((d) => (d.scheduledFor === day ? { ...d, draftId: `draft-${day}`, ...over } : d)) };
  };

  it("a page the re-check set aside reads Set aside · Didn’t pass our checks, grey, and offers nothing", () => {
    const facts = withDay("2026-09-15", { state: "skipped", setAside: true });
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(facts, FIXTURE_MONTH))} />, { day: "2026-09-15" }));
    const day = root.querySelector('[data-testid="calendar-cell-2026-09-15"]')!;
    const badge = day.querySelector('[data-testid="day-state"]')!;
    expect([badge.getAttribute("data-state"), badge.textContent]).toEqual(["set_aside", COPY["calendar.day.set-aside"]]);
    expect(badge.classList.contains("badge-ghost")).toBe(true);
    expect(day.querySelector('[data-testid="cell-empty-line"]')?.textContent).toBe(COPY["calendar.empty.short.page-set-aside"]);
    expect(day.textContent).not.toContain(COPY["calendar.day.stopped.line"]);
    expect(day.querySelector('[data-testid="cell-stop"], [data-testid="cell-edit"]')).toBeNull();
    const panel = root.querySelector('[data-testid="day-panel"]')!;
    expect(panel.querySelector('[data-testid="day-empty-line"]')?.textContent).toBe(COPY["calendar.empty.page-set-aside"]);
    expect(panel.querySelector('[data-testid="day-actions"]')).toBeNull();
  });

  it.each([
    ["the writing rules stopped, unedited", "planned", { kind: "rules", rules: ["title"] }],
    ["a publish tried out today, re-attempted daily", "planned", { kind: "delivery", since: "2026-09-15T12:00:00.000Z" }],
    ["a destination the customer must fix", "needs_you", { kind: "destination" }],
    ["the customer's own words", "needs_you", { kind: "live_edit" }],
  ] as const)("a needs_attention page whose cause is %s is %s", (_case, stage, needsYou) => {
    const facts = withDay("2026-09-15", { state: "needs_attention", needsYou });
    const model = assembleMonth(facts, FIXTURE_MONTH);
    expect(model.cells.find((cell) => cell.day === "2026-09-15")?.page?.stage).toBe(stage);
    expect(model.counts.needs_you).toBe(stage === "needs_you" ? 1 : 0);
    const root = render(withNuqs(<CalendarView {...shown(model)} />, { day: "2026-09-15" }));
    const words = [root.querySelector('[data-testid="calendar-cell-2026-09-15"]')!.textContent, root.querySelector('[data-testid="panel-stage-word"]')?.textContent];
    expect(words.some((text) => text?.includes(COPY["calendar.stage.needs-you"]))).toBe(stage === "needs_you");
  });
});

describe("each page day draws the board's icons", () => {
  it("New/Update chips and the Planned badge carry their icons", () => {
    const facts = fullWeek();
    const drafts = facts.drafts.map((d, at) => ({ ...d, update: at % 2 === 1 }));
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth({ ...facts, drafts }, FIXTURE_MONTH))} />));
    const icon = (el: Element | null | undefined): string | null =>
      el?.querySelector("svg")?.getAttribute("class")?.match(/\blucide-([a-z-]+)\b(?<!lucide-icon)/)?.[1] ?? null;
    const chips = cells(root).map((cell) => cell.querySelector('[data-testid="day-kind"]'));
    expect(chips.map(icon)).toEqual(["plus", "refresh-cw", "plus", "refresh-cw", "plus", "refresh-cw", "plus"]);
    for (const chip of chips) {
      expect(chip?.classList.contains("gap-1")).toBe(true);
      expect(chip?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(chip?.querySelector("svg")?.classList.contains("size-3")).toBe(true);
    }
    const badges = cells(root).map((cell) => cell.querySelector('[data-testid="day-state"]'));
    expect(badges.map(icon)).toEqual([null, null, null, "calendar", "calendar", "calendar", "calendar"]);
    // The stopped badge carries the board's stop icon; a skipped day draws none.
    const fixture = render(withNuqs(<CalendarView {...shown(assembleMonth(ALL_ARMS, FIXTURE_MONTH))} />));
    expect(cells(fixture).slice(5).map((cell) => icon(cell.querySelector('[data-testid="day-state"]')))).toEqual(["circle-stop", null]);
  });
});
