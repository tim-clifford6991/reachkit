/** @vitest-environment jsdom */
// tests/app/calendar/horizon.test.tsx — SPEC §7, issue 857, issue 1455
//
// The calendar plans the next seven days, today among them, and no further. Through the real
// calendar page: `CalendarPage` → `readMonth` → `readCalendarFacts` → the
// real `supplyDepth` and `supplyMeasured` over a stood-in opportunity store
// in a thin market. Only the reads this suite is not about (§9's pages,
// §11's stop, REQ-071's hold, the ranked list, the side panel) are stood in,
// each at its own honest "nothing".
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { measured } from "@/lib/measure/measured";
import { COPY } from "@/lib/presentation/copy";
import type { OpportunityStore } from "@/lib/opportunities/store";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";
import type { StoredReport } from "@/lib/scan/report";

let clock = new Date(0);
vi.mock("@/lib/config/now", () => ({ now: () => clock }));

vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
  committedWeek: async () => ({ days: [], spares: [] }),
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
// Issue 1457: Plan's *Published* list reads publications; these cases are
// about supply, so the list is empty.
vi.mock("@/app/(account)/app/_overview/content-provider", () => ({
  readPublishedFor: async () => ({ pages: [], now: new Date(0) }),
}));
vi.mock("@/app/(account)/app/_shell/onboarding", () => ({ readOnboarding: async () => ({ kind: "none" }) }));
vi.mock("@/app/(account)/app/_shell/remeasure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/(account)/app/_shell/remeasure")>()),
  readCategoryChoice: async () => ({ suggestions: ["bookkeeping software"] }),
}));
vi.mock("@/lib/market/changes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/market/changes")>()),
  declaredAnswers: async () => null,
  measuredAnswers: async () => null,
  declaredTimezone: async () => null,
}));

const { setOpportunityStore } = await import("@/lib/opportunities/store");
const provider = await import("@/app/(account)/app/calendar/provider");
const { default: CalendarPage } = await import("@/app/(account)/app/calendar/page");
import { withNuqs } from "./nuqs-adapter";

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

/** A market too small: the current scan derived no questions. */
const THIN_MARKET: OpportunityStore = {
  ...memoryStore(newMemoryState()),
  countUnused: async () => 0,
  lastStatusChangeAt: async () => null,
  latestCompletedScanAt: async () => AT,
  currentReport: async () => ({ questions: measured([], AT) }) as unknown as StoredReport,
};

async function open(a: { at: Date; timeZone: string; month: string }) {
  clock = a.at;
  setOpportunityStore(THIN_MARKET);
  provider.setCalendarSiteReader(async () => ({ siteId: "site-1", timeZone: a.timeZone }));
  const model = await provider.readMonth(a.month);
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(withNuqs(await CalendarPage()));
  const cell = (day: string) => root.querySelector(`[data-testid="calendar-cell-${day}"]`);
  return { model, root, cell };
}

afterEach(() => {
  provider.setCalendarSiteReader(null);
  setOpportunityStore(null);
});

describe("issue 857 — a thin market on a Wednesday", () => {
  // 10:00 on Wednesday 2026-09-16 in New York.
  const WEDNESDAY = { at: new Date(Date.UTC(2026, 8, 16, 14, 0, 0)), timeZone: "America/New_York", month: "2026-09" };

  it("states the supply state exactly once, and no cell or panel repeats it", async () => {
    const { root } = await open(WEDNESDAY);
    expect(root.querySelectorAll('[data-testid="calendar-supply-statement"]')).toHaveLength(1);
    expect(root.querySelector('[data-testid="calendar-supply-statement"]')?.textContent).toBe(
      COPY["calendar.supply.unmeasured"]
    );
    const text = root.textContent ?? "";
    expect(text.split("found enough searches").length - 1).toBe(1);
    expect(text).not.toContain(COPY["calendar.empty.supply-unmeasured"]);
    expect(root.querySelectorAll('[data-testid="cell-empty-line"]')).toHaveLength(0);
  });

  it("the plan is Wednesday through the next Tuesday; past days and the days after carry no line", async () => {
    const { model, cell } = await open(WEDNESDAY);
    const plan = model.cells.filter((c) => c.inMonth && c.when === "plan").map((c) => c.day);
    expect(plan).toEqual(["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"]);
    expect(model.horizonEnd).toBe("2026-09-22");
    for (const c of model.cells.filter((x) => x.inMonth && x.when !== "plan")) {
      expect(c.empty, c.day).toBeNull();
    }
    // The week's past days, Monday and Tuesday, state nothing.
    for (const day of ["2026-09-14", "2026-09-15"]) {
      expect(cell(day), day).not.toBeNull();
      expect(cell(day)?.querySelector('[data-testid="day-state"]'), day).toBeNull();
      expect(cell(day)?.querySelector('[data-testid="cell-empty-line"]'), day).toBeNull();
    }
  });
});

describe("issue 857 — Monday, before and after the weekly pass", () => {
  // The pass is due at 06:00 site-local. 05:00 and 07:00 in New York.
  for (const [when, at] of [
    ["before", new Date(Date.UTC(2026, 8, 21, 9, 0, 0))],
    ["after", new Date(Date.UTC(2026, 8, 21, 11, 0, 0))],
  ] as const) {
    it(`${when} the pass: the plan runs Monday through Sunday`, async () => {
      const { model } = await open({ at, timeZone: "America/New_York", month: "2026-09" });
      expect(model.today).toBe("2026-09-21");
      expect(model.horizonEnd).toBe("2026-09-27");
    });
  }
});

describe("issue 857 — the horizon is counted from the site's own today", () => {
  // 20:00 UTC on 2026-09-20: Sunday 21:00 in London, Monday 08:00 in Auckland.
  const AT_EDGE = new Date(Date.UTC(2026, 8, 20, 20, 0, 0));

  it("Europe/London: still Sunday, so the plan runs to Saturday — never one day (issue 1455)", async () => {
    const { model } = await open({ at: AT_EDGE, timeZone: "Europe/London", month: "2026-09" });
    expect(model.today).toBe("2026-09-20");
    expect(model.horizonEnd).toBe("2026-09-26");
  });

  it("Pacific/Auckland: already Monday, so the plan runs to the next Sunday", async () => {
    const { model } = await open({ at: AT_EDGE, timeZone: "Pacific/Auckland", month: "2026-09" });
    expect(model.today).toBe("2026-09-21");
    expect(model.horizonEnd).toBe("2026-09-27");
  });
});
