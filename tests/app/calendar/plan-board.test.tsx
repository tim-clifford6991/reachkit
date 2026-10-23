/** @vitest-environment jsdom */
// tests/app/calendar/plan-board.test.tsx — board Plan: the head, the four
// numbers, the week card with its range, go-live time, chips, why sentences,
// legend, next Monday and how the week was chosen, in the board's order; and
// the states the board names (a day stopped, a day skipped, the first week,
// an address not yet working).
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY, copy } from "@/lib/presentation/copy";

// The side panel reads the session; the fixture account has none to read here.
vi.mock("@/app/(account)/app/_shell/onboarding", () => ({ readOnboarding: async () => ({ kind: "none" }) }));

const provider = await import("@/app/(account)/app/calendar/provider");
const { default: CalendarPage } = await import("@/app/(account)/app/calendar/page");
const { CalendarView } = await import("@/app/(account)/app/calendar/CalendarView");
const { planHeadWords } = await import("@/app/(account)/app/calendar/PlanHead");
const { WeekHead, weekGoesLive } = await import("@/app/(account)/app/calendar/WeekCard");
const { assembleMonth } = await import("@/app/(account)/app/calendar/month");
const { FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH } = await import("@/app/(account)/app/calendar/fixture");
const { shown, withNuqs } = await import("./nuqs-adapter");

function render(el: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

async function fixturePage(): Promise<HTMLElement> {
  provider.setCalendarSiteReader(async () => null);
  return render(withNuqs(await CalendarPage()));
}

// The week as the page draws it, with the fixture's stop and hold replaced by `over`.
function board(over: Partial<typeof FIXTURE_CALENDAR_FACTS>): HTMLElement {
  const { week } = shown(assembleMonth({ ...FIXTURE_CALENDAR_FACTS, stop: null, customerChangeHoldsPages: null, ...over }, FIXTURE_MONTH));
  const time = weekGoesLive(week, "09:00");
  const head = <WeekHead range="" time={time === null ? null : copy("calendar.week.time", { time, place: "New York" })} />;
  return render(withNuqs(<CalendarView week={week} goesLive={time} head={head} />));
}

afterEach(() => provider.setCalendarSiteReader(null));

describe("board Plan, on the fixture account's week", () => {
  it("the head names the week of service, its page count and the day it was chosen", async () => {
    const head = (await fixturePage()).querySelector('[data-testid="plan-head"]')!;
    expect(text(head.querySelector(".eyebrow"))).toBe("Plan · week 3");
    expect(text(head.querySelector("h1"))).toBe("This week’s 5 pages");
    expect(text(head.querySelector("p"))).toBe("Chosen Monday, September 14. Each goes live on its day unless you stop it.");
  });

  it("the four numbers: pages this week, live so far, spares kept ready, stopped by you", async () => {
    const root = await fixturePage();
    const numbers = [...root.querySelectorAll('[data-testid="plan-numbers"] > div')].map((tile) =>
      [...tile.querySelectorAll(".card-body > span")].map(text).join(" ")
    );
    expect(numbers).toEqual([
      `5 ${COPY["calendar.numbers.week"]}`,
      expect.stringMatching(new RegExp(`^\\d+ ${COPY["calendar.numbers.live"]}$`)),
      `2 ${COPY["calendar.numbers.spares"]}`,
      `0 ${COPY["calendar.numbers.stopped"]}`,
    ]);
  });

  it("the week card: its range, that it runs by itself, and when every page goes live in the site's zone", async () => {
    const card = (await fixturePage()).querySelector('[data-testid="plan-week-card"]')!;
    expect(text(card.querySelector("h2"))).toBe("Mon, September 14 – Sun, September 20");
    expect(card.getAttribute("aria-labelledby")).toBe(card.querySelector("h2")?.id);
    expect(card.textContent).toContain(COPY["how.week.auto"]);
    // The fixture account has a stop on file, so its own page promises no time.
    expect(card.querySelector('[data-testid="plan-week-time"]')).toBeNull();
    expect(text(board({}).querySelector('[data-testid="plan-week-time"]'))).toBe("Every page goes live at 9:00 AM, New York time");
  });

  it("each page carries its New or Update chip, and today's page says when it goes live beside Edit and Stop", async () => {
    const card = (await fixturePage()).querySelector('[data-testid="plan-week-card"]')!;
    const today = card.querySelector('[data-testid="calendar-cell-2026-09-15"]')!;
    expect(text(today.querySelector('[data-testid="day-kind"]'))).toBe(COPY["calendar.chip.new"]);
    expect(today.querySelector('[data-testid="cell-goes-live"]')).toBeNull();
    const running = board({});
    expect(text(running.querySelector('[data-testid="calendar-cell-2026-09-15"] [data-testid="cell-goes-live"]'))).toBe("Goes live today, 9:00 AM");
    expect(text(today.querySelector('[data-testid="cell-edit"]'))).toBe(COPY["how.week.edit"]);
    expect(today.querySelector('[data-testid="cell-edit"]')?.getAttribute("href")).toBe("/app/draft/draft-2026-09-15");
    const kinds = [...card.querySelectorAll('[data-testid="calendar-week"] [data-testid="day-kind"]')].map(text);
    expect(kinds).toContain(COPY["calendar.card.update"]);
    // Only today's page names a time; the others say their state.
    expect(running.querySelectorAll('[data-testid="cell-goes-live"]')).toHaveLength(1);
  });

  it("a planned page says why under 'Why', in the sentence for the reason its week stored", async () => {
    const cell = (await fixturePage()).querySelector('[data-testid="calendar-cell-2026-09-18"]')!;
    expect(text(cell.querySelector('[data-testid="cell-why"]')?.firstElementChild)).toBe(COPY["calendar.week.why"]);
    expect(text(cell.querySelector('[data-testid="cell-why-line"]'))).toBe(COPY["calendar.reason.searched"]);
  });

  it("under the days: the legend, the next Monday's pass, and how this week's pages were chosen", async () => {
    const card = (await fixturePage()).querySelector('[data-testid="plan-week-card"]')!;
    expect([...card.querySelectorAll('[data-testid="plan-legend"] > span')].map(text)).toEqual([
      `${COPY["calendar.chip.new"]} ${COPY["calendar.legend.new"]}`,
      `${COPY["calendar.card.update"]} ${COPY["calendar.legend.update"]}`,
    ]);
    expect(text(card.querySelector('[data-testid="plan-next"]'))).toBe(
      "Monday, September 21: we check your searches, pages and competitors again, and choose the next 7."
    );
    const chosen = card.querySelector('[data-testid="plan-chosen"]')!;
    expect(text(chosen.querySelector("summary"))).toBe(COPY["calendar.chosen.title"]);
    expect([...chosen.querySelectorAll("p")].map(text)).toEqual([copy("calendar.chosen.body", { n: "7" }), COPY["calendar.chosen.stored"]]);
  });

  it("the sections stand in the board's order: head, numbers, week, spares, then the live pages", async () => {
    const root = await fixturePage();
    const order = ["plan-head", "plan-numbers", "plan-week-card", "plan-legend", "plan-next", "plan-chosen", "calendar-spares", "plan-published"].map(
      (id) => root.querySelector(`[data-testid="${id}"]`)
    );
    expect(order.every((el) => el !== null)).toBe(true);
    for (let at = 1; at < order.length; at++) {
      expect(order[at - 1]!.compareDocumentPosition(order[at]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${at}`).toBeTruthy();
    }
  });
});

describe("Live pages: each page's steps as dots, its standing and its label", () => {
  const rows = (root: Element): Element[] => [...root.querySelectorAll('[data-testid="plan-published-row"]')];
  const byTitle = (root: Element, title: string): Element => rows(root).find((row) => row.textContent?.includes(title))!;

  it("is headed Live pages with what the dots are, shows four, and opens the rest under Show all", async () => {
    const live = (await fixturePage()).querySelector('[data-testid="plan-published"]')!;
    expect(text(live.querySelector("h2"))).toBe(COPY["calendar.live.title"]);
    expect(live.textContent).toContain(COPY["calendar.live.dots"]);
    expect(rows(live)).toHaveLength(17);
    expect(live.querySelectorAll(':scope > .card-body > ul > [data-testid="plan-published-row"]')).toHaveLength(4);
    const more = live.querySelector('[data-testid="plan-live-more"] summary')!;
    expect([...more.children].map(text)).toEqual(["4 of 17 live pages", "Show all 17"]);
  });

  it("a page in results says its place, how far it rose and since when, and its dots reach Showing", async () => {
    const row = byTitle(await fixturePage(), "How to price a small project");
    expect(row.querySelector("p")?.textContent).toMatch(/^Place 36 for “fixture search 9”, up 14 since \w{3} \d+, 2026\.$/);
    expect(text(row.querySelector('[data-testid="plan-live-google"]'))).toBe(`Google: ${COPY["draft.ladder.showing"]}`);
    expect([...row.querySelectorAll('[data-testid="plan-live-google"] [data-reached]')].map((dot) => dot.getAttribute("data-reached"))).toEqual([
      "yes",
      "yes",
      "yes",
      "not-yet",
    ]);
    expect(row.querySelector(".badge")).not.toBeNull();
  });

  it("a page found but not in results says when Google found it", async () => {
    const row = byTitle(await fixturePage(), "Late payment reminders that work");
    expect(row.querySelector("p")?.textContent).toMatch(/^Found by Google on \w{3} \d+, 2026\. Not in results yet\.$/);
  });

  it("a page an answer engine linked says which one", async () => {
    const row = byTitle(await fixturePage(), "Choosing payment terms");
    expect(row.querySelector("p")?.textContent).toContain(copy("calendar.live.linked", { engines: COPY["ai-answers.engine.chatgpt"] }));
  });

  it("a page never read says not measured, with hollow dots, never an empty step", async () => {
    const row = byTitle(await fixturePage(), "What an onboarding checklist should hold");
    expect(text(row.querySelector('[data-testid="plan-live-ai"]'))).toBe(`AI: ${COPY["draft.ladder.unmeasured"]}`);
    const dots = [...row.querySelectorAll('[data-testid="plan-live-ai"] [data-reached]')].map((dot) => dot.getAttribute("data-reached"));
    expect(dots.length).toBeGreaterThan(0);
    expect(new Set(dots)).toEqual(new Set(["unmeasured"]));
    expect(row.querySelector(".badge")).toBeNull();
  });
});

describe("the states board Plan names", () => {
  it("a day stopped by the customer says so, and that the other days are not affected", () => {
    const drafts = FIXTURE_CALENDAR_FACTS.drafts.map((d) => (d.scheduledFor === "2026-09-16" ? { ...d, state: "skipped" as const } : d));
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth({ ...FIXTURE_CALENDAR_FACTS, drafts }, FIXTURE_MONTH))} />));
    const cell = root.querySelector('[data-testid="calendar-cell-2026-09-16"]')!;
    expect(text(cell.querySelector('[data-testid="cell-state-line"]'))).toBe(COPY["calendar.day.stopped.line"]);
    expect(cell.querySelector('[data-testid="cell-label"]')).toBeNull();
  });

  it("a skipped day says a day is skipped and never filled, once in the week", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH))} />));
    const lines = [...root.querySelectorAll('[data-testid="calendar-week"] [data-testid="cell-state-line"]')].map(text);
    expect(lines).toEqual([COPY["calendar.day.skipped.line"]]);
    expect(root.querySelector('[data-testid="calendar-cell-2026-09-20"]')?.textContent).toContain(COPY["calendar.day.skipped.line"]);
  });

  it("while the address does not work, no go-live time is named", () => {
    const root = render(withNuqs(<CalendarView {...shown(assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH))} goesLive={null} />));
    expect(root.querySelector('[data-testid="cell-goes-live"]')).toBeNull();
  });

  it("while publishing is paused, today's page and the week card name no go-live time", () => {
    const running = board({});
    expect(running.querySelector('[data-testid="calendar-cell-2026-09-15"] [data-testid="cell-goes-live"]')).not.toBeNull();
    expect(running.querySelector('[data-testid="plan-week-time"]')).not.toBeNull();
    const paused = board({ customerChangeHoldsPages: "publishing_off" });
    expect(paused.querySelector('[data-testid="calendar-cell-2026-09-15"] [data-testid="day-kind"]')).not.toBeNull();
    expect(paused.querySelector('[data-testid="cell-goes-live"]')).toBeNull();
    expect(paused.querySelector('[data-testid="plan-week-time"]')).toBeNull();
    expect(paused.textContent).not.toContain("Every page goes live at");
  });

  it("while ReachKit has stopped its own work, today's page and the week card name no go-live time", () => {
    const stopped = board({ stop: FIXTURE_CALENDAR_FACTS.stop });
    expect(stopped.querySelector('[data-testid="calendar-cell-2026-09-15"] [data-testid="day-kind"]')).not.toBeNull();
    expect(stopped.querySelector('[data-testid="cell-goes-live"]')).toBeNull();
    expect(stopped.querySelector('[data-testid="plan-week-time"]')).toBeNull();
    expect(stopped.textContent).not.toContain("Every page goes live at");
  });

  it("before the first commit the head says the first week is being chosen; a short week counts its real pages", () => {
    expect(planHeadWords({ week: 1, chosen: null, publishTime: null }, 0)).toEqual({
      eyebrow: "Plan · week 1",
      title: COPY["calendar.title.none"],
      lead: COPY["calendar.first-week"],
    });
    expect(planHeadWords({ week: null, chosen: "2026-10-21", publishTime: null }, 1)).toEqual({
      eyebrow: COPY["shell.nav.plan"],
      title: COPY["calendar.title.one"],
      lead: "Chosen Wednesday, October 21. Each goes live on its day unless you stop it.",
    });
  });
});
