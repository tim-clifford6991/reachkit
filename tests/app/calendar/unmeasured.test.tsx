/** @vitest-environment jsdom */
// tests/app/calendar/unmeasured.test.tsx — BUILD §4.6, REQ-043 c3, issue #765
//
// An empty day over zero supply says one of two things, and which one is a
// stored fact: a market whose opportunities were all used or held is
// *exhausted*; a market whose current scan derived no questions, or a site
// that never held an opportunity, was *never measured* — and "used up" is
// false there.
//
// Through the real calendar provider: `readMonth` → `readCalendarFacts` →
// the real `supplyDepth` and `supplyMeasured` over a stood-in opportunity
// store, then the grid and the day panel. Only the reads this suite is not
// about (§9's pages, §11's stop, REQ-071's hold, the ranked list) are
// stood in, each at its own honest "nothing".
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { measured } from "@/lib/measure/measured";
import { COPY } from "@/lib/presentation/copy";
import type { OpportunityStore } from "@/lib/opportunities/store";
import type { StoredReport } from "@/lib/scan/report";

const NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
const SITE = { siteId: "site-1", timeZone: "America/New_York" };
const MONTH = "2026-09";
const EMPTY_DAY = "2026-09-20";

vi.mock("@/lib/config/now", () => ({ now: () => NOW }));

vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  // Zero supply ranks nothing; the ranked list is not this suite's subject.
  nextForDay: async () => null,
  rankOpen: async () => [],
}));

vi.mock("@/app/(account)/app/calendar/drafts-read", () => ({
  readPublishingFacts: async () => ({
    readable: true,
    pagesByDay: new Map(),
    publishAt: new Map(),
    heldDays: [],
    customerChangeHoldsPages: null,
  }),
}));

vi.mock("@/app/(account)/app/_shell/stop", () => ({ readStop: async () => null }));

// The pass has released the founder; the side panel is not this suite's.
vi.mock("@/app/(account)/app/_shell/onboarding", () => ({ readOnboarding: async () => ({ kind: "none" }) }));

// Issue 837: the broader categories the empty calendar offers.
vi.mock("@/app/(account)/app/_shell/remeasure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/(account)/app/_shell/remeasure")>()),
  readCategoryChoice: async () => ({ suggestions: ["bookkeeping software", "therapist accounting"] }),
}));

vi.mock("@/lib/market/changes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/market/changes")>()),
  declaredAnswers: async () => null,
  measuredAnswers: async () => null,
  // No zone, no hold: a site replacing nothing.
  declaredTimezone: async () => null,
}));

const { setOpportunityStore } = await import("@/lib/opportunities/store");
const provider = await import("@/app/(account)/app/calendar/provider");
const { cellFor } = await import("@/app/(account)/app/calendar/month");
const { CalendarView } = await import("@/app/(account)/app/calendar/CalendarView");
const { DayPanelView } = await import("@/app/(account)/app/calendar/DayPanelView");
const { default: CalendarPage } = await import("@/app/(account)/app/calendar/page");

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

/** The four reads the two supply facts are made of, and nothing else. */
function storeWith(a: { questions: number; everHeld: boolean }): OpportunityStore {
  const report = {
    questions: measured(Array.from({ length: a.questions }, (_, i) => ({ id: `q${i}` })), AT),
  } as unknown as StoredReport;
  return {
    countUnused: async () => 0,
    lastStatusChangeAt: async () => (a.everHeld ? AT : null),
    latestCompletedScanAt: async () => AT,
    currentReport: async () => report,
  } as unknown as OpportunityStore;
}

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

async function emptyDay() {
  const model = await provider.readMonth(MONTH);
  const cell = cellFor(model, EMPTY_DAY);
  if (cell === undefined) throw new Error("no cell");
  const grid = render(<CalendarView model={model} />);
  const panel = render(<DayPanelView cell={cell} timeZone={SITE.timeZone} stopped={null} />);
  return {
    cause: cell.empty?.cause,
    cellLine: grid.querySelector(`[data-testid="calendar-cell-${EMPTY_DAY}"] [data-testid="cell-empty-line"]`)
      ?.textContent,
    panelLine: panel.querySelector('[data-testid="day-empty-line"]')?.textContent,
  };
}

beforeEach(() => {
  provider.setCalendarSiteReader(async () => SITE);
});

afterEach(() => {
  provider.setCalendarSiteReader(null);
  setOpportunityStore(null);
});

describe("#765 — zero supply says which zero it is", () => {
  it("exhausted: the market had questions and opportunities, all used or held — today's line stays", async () => {
    setOpportunityStore(storeWith({ questions: 12, everHeld: true }));
    const day = await emptyDay();
    expect(day.cause).toBe("supply_exhausted");
    expect(day.cellLine).toBe(COPY["cause.supply-exhausted"]);
    expect(day.panelLine).toBe(COPY["calendar.empty.supply-exhausted"]);
  });

  it("never measured: the current scan derived no questions — the honest line, never 'used up'", async () => {
    setOpportunityStore(storeWith({ questions: 0, everHeld: false }));
    const day = await emptyDay();
    expect(day.cause).toBe("supply_unmeasured");
    expect(day.cellLine).toBe(COPY["calendar.empty.supply-unmeasured"]);
    expect(day.panelLine).toBe(COPY["calendar.empty.supply-unmeasured"]);
    expect(day.panelLine).not.toBe(COPY["calendar.empty.supply-exhausted"]);
  });

  it("never measured: questions exist but the site never held an opportunity", async () => {
    setOpportunityStore(storeWith({ questions: 12, everHeld: false }));
    expect((await emptyDay()).cause).toBe("supply_unmeasured");
  });

  it("never measured: opportunities were held once, but the current scan has zero questions", async () => {
    setOpportunityStore(storeWith({ questions: 0, everHeld: true }));
    expect((await emptyDay()).cause).toBe("supply_unmeasured");
  });

  it("a measured-ness read that fails claims neither state", async () => {
    setOpportunityStore({
      ...storeWith({ questions: 12, everHeld: true }),
      currentReport: async () => {
        throw new Error("the database is down");
      },
    } as unknown as OpportunityStore);
    expect((await emptyDay()).cause).toBe("unattributed");
  });
});

describe("#784 — the calendar's one supply statement says which zero it is", () => {
  async function statement(): Promise<string | null> {
    const page = await CalendarPage({ searchParams: Promise.resolve({ month: MONTH }) });
    return render(page).querySelector('[data-testid="calendar-supply-statement"]')?.textContent ?? null;
  }

  it("a market used up keeps 'nothing worth publishing is left'", async () => {
    setOpportunityStore(storeWith({ questions: 12, everHeld: true }));
    expect(await statement()).toContain(COPY["calendar.supply.exhausted"].split("{")[0]);
  });

  it("a market never measured says so, never 'used up'", async () => {
    setOpportunityStore(storeWith({ questions: 0, everHeld: false }));
    expect(await statement()).toBe(COPY["calendar.supply.unmeasured"]);
  });

  it("a market never measured offers the broader categories that measure it again now (issue 837)", async () => {
    setOpportunityStore(storeWith({ questions: 0, everHeld: false }));
    const page = render(await CalendarPage({ searchParams: Promise.resolve({ month: MONTH }) }));
    const choice = page.querySelector('[data-testid="calendar-market-choice"]');
    expect([...(choice?.querySelectorAll('[data-testid="category-suggestion"]') ?? [])].map((b) => b.textContent)).toEqual([
      "bookkeeping software",
      "therapist accounting",
    ]);
    expect(page.querySelector('[data-testid="calendar-supply-statement"]')?.textContent).not.toMatch(/Monday/);

    setOpportunityStore(storeWith({ questions: 12, everHeld: true }));
    const used = render(await CalendarPage({ searchParams: Promise.resolve({ month: MONTH }) }));
    expect(used.querySelector('[data-testid="calendar-market-choice"]')).toBeNull();
  });

  it("a measured-ness read that fails states neither", async () => {
    setOpportunityStore({
      ...storeWith({ questions: 12, everHeld: true }),
      currentReport: async () => {
        throw new Error("the database is down");
      },
    } as unknown as OpportunityStore);
    expect(await statement()).toBeNull();
  });
});
