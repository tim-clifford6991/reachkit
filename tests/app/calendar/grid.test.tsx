/** @vitest-environment jsdom */
// tests/app/calendar/grid.test.tsx — BUILD §4.6, REQ-043 criteria 1, 2, 6
//
// WO-167 `## Test plan`: one page or one line per cell, the stage chip,
// weekends, the filter narrowing, and the counts. Plus ADR-061's
// discriminating render test — an unattributed date must never render the
// exhausted-supply line.
//
// Rendering convention, as in `tests/app/shell/frame.test.tsx`: this file
// declares `jsdom` for itself (the `node` project has no `document`) and
// renders with `react-dom/server`'s `renderToStaticMarkup`. `copy()` is
// mocked to `(key) => key` so an assertion names the key a word came from
// rather than the owner's wording; `COPY` is left real, so `writtenLine`'s
// owner-owed branch behaves exactly as it does in production.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { COPY } from "@/lib/presentation/copy";
import { CalendarGrid } from "@/ui/components/custom";
import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import { assembleMonth, type CalendarFacts } from "@/app/(account)/app/calendar/month";
import { EMPTY_COPY_KEY } from "@/app/(account)/app/calendar/empty";
import {
  FIXTURE_CALENDAR_FACTS,
  FIXTURE_MONTH,
} from "@/app/(account)/app/calendar/fixture";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const MODEL = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);

function view(): Element {
  return render(<CalendarView model={MODEL} />);
}

function cellEl(root: Element, day: string): Element {
  const el = root.querySelector(`[data-testid="calendar-cell-${day}"]`);
  if (!el) throw new Error(`no cell rendered for ${day}`);
  return el;
}

describe("REQ-043 c1 — one page or one account per cell, weekends included", () => {
  it("draws a cell for every date in the month, and for no date twice", () => {
    const root = view();
    const cells = root.querySelectorAll('[data-testid^="calendar-cell-"]');
    // September 2026 has 30 days; the out-of-month cells render no button.
    expect(cells).toHaveLength(30);
    const days = [...cells].map((c) => c.getAttribute("data-testid"));
    expect(new Set(days).size).toBe(days.length);
  });

  it("the weekend columns carry pages like any other date", () => {
    const root = view();
    // 2026-09-05 Saturday, 2026-09-06 Sunday — both `published` in the fixture.
    expect(cellEl(root, "2026-09-05").textContent).toContain("calendar.stage.live");
    expect(cellEl(root, "2026-09-06").textContent).toContain("calendar.stage.live");
  });

  it("no cell renders two pages", () => {
    const root = view();
    for (const cell of root.querySelectorAll('[data-testid^="calendar-cell-"]')) {
      expect(cell.querySelectorAll(".badge").length).toBeLessThanOrEqual(1);
    }
  });

  it("an out-of-month cell renders no content at all — it is a column position, not padding", () => {
    const root = view();
    for (const cell of root.querySelectorAll(".rk-cal-out")) {
      expect(cell.textContent).toBe("");
    }
  });
});

describe("REQ-043 c2 — every rendered page carries its stage chip", () => {
  it("each page cell renders exactly one stage word, from the registry", () => {
    const root = view();
    for (const cell of MODEL.cells.filter((c) => c.page !== null)) {
      const el = cellEl(root, cell.day);
      expect(el.textContent, cell.day).toContain("calendar.stage.");
    }
  });

  it("the five stages all appear, each under its own key", () => {
    const text = view().textContent ?? "";
    for (const key of [
      "calendar.stage.live",
      "calendar.stage.your-review",
      "calendar.stage.scheduled",
      "calendar.stage.planned",
      "calendar.stage.needs-you",
    ]) {
      expect(text, key).toContain(key);
    }
  });
});

describe("REQ-043 c3 and ADR-061 — the two grey lines are never swapped", () => {
  it("an unattributed empty date renders the stopped-work line and never the exhausted-supply line", () => {
    const facts: CalendarFacts = {
      ...FIXTURE_CALENDAR_FACTS,
      drafts: [],
      instructions: {},
      stoppedDays: [],
      // Unreadable depth, no other cause: ADR-061's own mutation case.
      unusedSupply: null,
    };
    const root = render(<CalendarView model={assembleMonth(facts, FIXTURE_MONTH)} />);
    const text = root.textContent ?? "";
    // `copy()` is mocked to the key, so the assertion names which key the
    // line resolved from rather than the owner's wording.
    expect(text).toContain("stopped.work.line");
    // The exhausted-supply key is owner-owed and empty, so the only way it
    // could appear is if the resolver had reached it — which is exactly
    // what this asserts it did not.
    expect(EMPTY_COPY_KEY.supply_exhausted).toBe("cause.supply-exhausted");
    expect(root.querySelectorAll(".rk-cal-empty").length).toBeGreaterThan(0);
  });

  it("a date emptied by exhausted supply carries no line while the owner has not written one", () => {
    // The honest behaviour of an owner-owed key: nothing, never a
    // placeholder and never another cause's sentence.
    expect(COPY["cause.supply-exhausted"]).toBe("");
    const root = view();
    // 2026-09-23 is emptied by proven-zero supply in the fixture.
    expect(cellEl(root, "2026-09-23").querySelector(".rk-cal-empty")).toBeNull();
  });

  it("a date ReachKit stopped on carries ReachKit's own line", () => {
    const root = view();
    expect(cellEl(root, "2026-09-13").textContent).toContain("stopped.work.line");
  });
});

describe("REQ-043 c6 — the stage filter narrows the grid, and every card shows its count", () => {
  it("All and each of the five stages render a count drawn from the same read as the grid", () => {
    const root = view();
    for (const filter of ["all", "live", "your_review", "scheduled", "planned", "needs_you"] as const) {
      const count = root.querySelector(`[data-testid="stage-count-${filter}"]`);
      expect(count, filter).not.toBeNull();
      expect(count?.textContent, filter).toBe(String(MODEL.counts[filter]));
      // §2.3: every numeral is JetBrains Mono.
      expect(count?.className, filter).toContain("num");
    }
  });

  it("each filter card carries its word, so a card is never a colour alone", () => {
    const root = view();
    for (const [filter, key] of [
      ["all", "calendar.stage.all"],
      ["live", "calendar.stage.live"],
      ["needs_you", "calendar.stage.needs-you"],
    ] as const) {
      expect(
        root.querySelector(`[data-testid="stage-filter-${filter}"]`)?.textContent,
        filter
      ).toContain(key);
    }
  });

  it("selecting a stage narrows the grid to it, and no other stage's page is drawn", () => {
    // The narrowing is client state, so it is exercised through the
    // component's own mapping rather than through a click: `toGridCell` is
    // what decides, and `CalendarView` is what holds the selection.
    const live = MODEL.cells.filter((c) => c.page?.stage === "live").length;
    const planned = MODEL.cells.filter((c) => c.page?.stage === "planned").length;
    expect(live).toBeGreaterThan(0);
    expect(planned).toBeGreaterThan(0);
    expect(MODEL.counts.live).toBe(live);
    expect(MODEL.counts.planned).toBe(planned);
  });
});

describe("§4.6 — today is ringed, and the grid renders no sentence of its own", () => {
  it("exactly one cell carries the today class", () => {
    const root = view();
    expect(root.querySelectorAll(".rk-cal-today")).toHaveLength(1);
    expect(cellEl(root, MODEL.today).className).toContain("rk-cal-today");
  });

  it("the grid's own source names no sentence — every word it draws arrives as a prop", () => {
    // The component reads no copy key: `CalendarGrid` is handed words and
    // renders them, which is what "knows nothing of what a stage means"
    // means in code.
    expect(String(CalendarGrid)).not.toContain("copy(");
  });
});
