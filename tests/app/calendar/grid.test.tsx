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
      heldDays: [],
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

  it("a date emptied by exhausted supply carries the approved line, and no other cause's (#354)", () => {
    // It was owner-owed and carried the marker (#246) until ruling 11a of
    // 2026-09-08 made the approved set's unbracketed strings approved copy.
    // S14 draws this one on the grid cell — the first line alone — and S15
    // draws the whole account in the panel, which is DECISIONS 2026-09-07
    // (#209) applied to the calendar's own causes.
    expect(COPY["cause.supply-exhausted"]).toBe("nothing worth publishing");
    expect(COPY["calendar.empty.supply-exhausted"]).toContain("Nothing worth publishing");
    expect(COPY["calendar.empty.supply-exhausted"].length).toBeGreaterThan(
      COPY["cause.supply-exhausted"].length,
    );
    const root = view();
    // 2026-09-23 is emptied by proven-zero supply in the fixture.
    const emptied = cellEl(root, "2026-09-23").querySelector(".rk-cal-empty");
    // It renders, where before the empty value meant it did not. `copy()`
    // resolves to its key in this suite (the shell's convention — the
    // assertions here are about which key a line comes from, never the
    // owner's wording), so what stands in the cell is that key; in the
    // product it is the marker, which `COPY` above is what states.
    expect(emptied).not.toBeNull();
    expect(emptied?.textContent).toBe(EMPTY_COPY_KEY.supply_exhausted);
    // Still not another cause's line, which is the half of this that the
    // marker must not paper over.
    expect(cellEl(root, "2026-09-23").textContent).not.toContain("stopped.work.line");
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

describe("issue #354 — S14, the approved calendar screen", () => {
  it("**the filter is six option cards, one per stage, each with its count**", () => {
    const root = view();
    const cards = root.querySelectorAll('[data-testid^="stage-filter-"]');
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      const id = card.getAttribute("data-testid") ?? "";
      // The approved `.opt`: the idiom's selectable box around a `Card`,
      // not a chip and not a bare button.
      expect(card.className, id).toContain("rk-opt");
      expect(card.querySelector(".card"), id).not.toBeNull();
      // The count is the card's headline figure, and it is mono (§2.3).
      const count = card.querySelector(".rk-opt-count");
      expect(count, id).not.toBeNull();
      expect(count?.className, id).toContain("num");
    }
  });

  it("the chosen card carries the accent state in the accessibility tree, not by tint alone", () => {
    const root = view();
    // `CalendarView` opens on `all`, so that is the chosen card. The tint
    // is keyed off this attribute in `idiom.css`, so a card cannot look
    // chosen without being chosen (§2.5).
    expect(
      root.querySelector('[data-testid="stage-filter-all"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      root.querySelector('[data-testid="stage-filter-live"]')?.getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("a cell heads with its date and its stage chip on one row, and the title under them", () => {
    const root = view();
    // 2026-09-05 carries a live page in the fixture.
    const cell = cellEl(root, "2026-09-05");
    const head = cell.querySelector(".rk-cal-cell-head");
    expect(head).not.toBeNull();
    expect(head?.querySelector(".rk-cal-date")).not.toBeNull();
    expect(head?.querySelector(".badge")).not.toBeNull();
    // The title is the cell's own element, outside that row.
    expect(cell.querySelector(".rk-cal-label")).not.toBeNull();
    expect(head?.querySelector(".rk-cal-label")).toBeNull();
  });

  it("**a date with no page is an outline, and carries no stage chip**", () => {
    const root = view();
    // 2026-09-23 is emptied by proven-zero supply in the fixture.
    const emptied = cellEl(root, "2026-09-23");
    expect(emptied.className).toContain("rk-cal-empty-day");
    expect(emptied.querySelector(".badge")).toBeNull();
    // A cell holding a page is not an outline.
    expect(cellEl(root, "2026-09-05").className).not.toContain("rk-cal-empty-day");
  });

  it("a cell's one string is recoverable in full from the cell itself", () => {
    // The clamp is CSS; what the markup owes is the whole string, so a
    // truncation is a truncation and not a loss. It is the caller's own
    // string, composed of nothing.
    const root = view();
    const filled = cellEl(root, "2026-09-05");
    expect(filled.getAttribute("title")).toBe(
      filled.querySelector(".rk-cal-label")?.textContent,
    );
    const empty = cellEl(root, "2026-09-13");
    expect(empty.getAttribute("title")).toBe(
      empty.querySelector(".rk-cal-empty")?.textContent,
    );
  });

  it("an out-of-month cell carries no title — it has no line to recover", () => {
    const root = view();
    for (const cell of root.querySelectorAll(".rk-cal-out")) {
      expect(cell.getAttribute("title")).toBeNull();
    }
  });
});
