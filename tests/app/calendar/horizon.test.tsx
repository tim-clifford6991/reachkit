/** @vitest-environment jsdom */
// tests/app/calendar/horizon.test.tsx — SPEC §7, issue 857
//
// The calendar plans only until the next weekly pass. Through the real
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
import type { StoredReport } from "@/lib/scan/report";

let clock = new Date(0);
vi.mock("@/lib/config/now", () => ({ now: () => clock }));

vi.mock("@/lib/opportunities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/opportunities")>()),
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

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

/** A market too small: the current scan derived no questions. */
const THIN_MARKET = {
  countUnused: async () => 0,
  lastStatusChangeAt: async () => null,
  latestCompletedScanAt: async () => AT,
  currentReport: async () => ({ questions: measured([], AT) }) as unknown as StoredReport,
} as unknown as OpportunityStore;

async function open(a: { at: Date; timeZone: string; month: string }) {
  clock = a.at;
  setOpportunityStore(THIN_MARKET);
  provider.setCalendarSiteReader(async () => ({ siteId: "site-1", timeZone: a.timeZone }));
  const model = await provider.readMonth(a.month);
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({ month: a.month }) }));
  const cell = (day: string) => root.querySelector(`[data-testid="calendar-cell-${day}"]`);
  const markers = [...root.querySelectorAll('[data-testid="calendar-horizon-marker"]')].map(
    (n) => n.closest('[data-testid^="calendar-cell-"]')?.getAttribute("data-testid")?.replace("calendar-cell-", "")
  );
  return { model, root, cell, markers };
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
    expect(text.split("couldn’t find enough searches").length - 1).toBe(1);
    expect(text).not.toContain(COPY["calendar.empty.supply-unmeasured"]);
    expect(root.querySelectorAll('[data-testid="cell-empty-line"]')).toHaveLength(0);
  });

  it("the plan is Wednesday through Sunday; past days and the days after carry no line", async () => {
    const { model, cell } = await open(WEDNESDAY);
    const plan = model.cells.filter((c) => c.inMonth && c.when === "plan").map((c) => c.day);
    expect(plan).toEqual(["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
    expect(model.horizonEnd).toBe("2026-09-20");
    for (const c of model.cells.filter((x) => x.inMonth && x.when !== "plan")) {
      expect(c.empty, c.day).toBeNull();
      if (c.horizonMarker) continue;
      expect(cell(c.day)?.textContent, c.day).toBe(String(Number(c.day.slice(8))));
    }
  });

  it("one quiet marker, on the Monday the next pass decides", async () => {
    const { markers, cell } = await open(WEDNESDAY);
    expect(markers).toEqual(["2026-09-21"]);
    expect(cell("2026-09-21")?.textContent).toContain(COPY["calendar.horizon.marker"]);
  });

  it("a month wholly after the horizon is blank but for the marker on its first date", async () => {
    const { model, markers, root } = await open({ ...WEDNESDAY, month: "2026-10" });
    expect(model.cells.every((c) => c.page === null && c.empty === null)).toBe(true);
    expect(markers).toEqual(["2026-10-01"]);
    expect(root.querySelectorAll('[data-testid="calendar-supply-statement"]')).toHaveLength(1);
  });
});

describe("issue 857 — Monday, before and after the weekly pass", () => {
  // The pass is due at 06:00 site-local. 05:00 and 07:00 in New York.
  for (const [when, at] of [
    ["before", new Date(Date.UTC(2026, 8, 21, 9, 0, 0))],
    ["after", new Date(Date.UTC(2026, 8, 21, 11, 0, 0))],
  ] as const) {
    it(`${when} the pass: the plan runs Monday through Sunday`, async () => {
      const { model, markers } = await open({ at, timeZone: "America/New_York", month: "2026-09" });
      expect(model.today).toBe("2026-09-21");
      expect(model.horizonEnd).toBe("2026-09-27");
      expect(markers).toEqual(["2026-09-28"]);
    });
  }
});

describe("issue 857 — the horizon's edge is the site's own Monday", () => {
  // 20:00 UTC on 2026-09-20: Sunday 21:00 in London, Monday 08:00 in Auckland.
  const AT_EDGE = new Date(Date.UTC(2026, 8, 20, 20, 0, 0));

  it("Europe/London: still Sunday, so the plan is Sunday alone", async () => {
    const { model, markers } = await open({ at: AT_EDGE, timeZone: "Europe/London", month: "2026-09" });
    expect(model.today).toBe("2026-09-20");
    expect(model.horizonEnd).toBe("2026-09-20");
    expect(markers).toEqual(["2026-09-21"]);
  });

  it("Pacific/Auckland: already Monday, so the plan runs to the next Sunday", async () => {
    const { model, markers } = await open({ at: AT_EDGE, timeZone: "Pacific/Auckland", month: "2026-09" });
    expect(model.today).toBe("2026-09-21");
    expect(model.horizonEnd).toBe("2026-09-27");
    expect(markers).toEqual(["2026-09-28"]);
  });
});
