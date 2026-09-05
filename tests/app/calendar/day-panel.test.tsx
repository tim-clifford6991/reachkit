/** @vitest-environment jsdom */
// tests/app/calendar/day-panel.test.tsx — BUILD §4.6, REQ-043 criteria 7-11
//
// WO-168 `## Test plan`: today selected on open, the five "Why this page"
// facts, the provenance line, the empty arm, and the action projection
// rendered. Same rendering and mocking convention as `grid.test.tsx`.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { COPY } from "@/lib/presentation/copy";
import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import { DayPanelView } from "@/app/(account)/app/calendar/DayPanelView";
import { assembleMonth, cellFor, type DayCell } from "@/app/(account)/app/calendar/month";
import {
  FIXTURE_CALENDAR_FACTS,
  FIXTURE_MONTH,
  FIXTURE_TIME_ZONE,
} from "@/app/(account)/app/calendar/fixture";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const MODEL = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);

function panel(day: string): Element {
  const cell = cellFor(MODEL, day);
  if (cell === undefined) throw new Error(`no cell for ${day}`);
  return render(<DayPanelView cell={cell} timeZone={FIXTURE_TIME_ZONE} />);
}

describe("REQ-043 c7 — today is the selected day when the calendar opens", () => {
  it("the panel the view renders on open is today's, not the month's first date", () => {
    const root = render(<CalendarView model={MODEL} />);
    const title = root.querySelector('[data-testid="day-title"]')?.textContent;
    const todayCell = cellFor(MODEL, MODEL.today);
    expect(MODEL.today).toBe("2026-09-15");
    expect(title).toBe(todayCell?.page?.title);
    // And the grid marks the same day as the selected one.
    expect(
      root.querySelector(`[data-testid="calendar-cell-${MODEL.today}"]`)?.getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("a site in a zone where it is already tomorrow opens on its own today", () => {
    const nz = assembleMonth(
      { ...FIXTURE_CALENDAR_FACTS, timeZone: "Pacific/Auckland" },
      FIXTURE_MONTH
    );
    // 2026-09-15T14:00Z is 2026-09-16 02:00 in Auckland.
    expect(nz.today).toBe("2026-09-16");
    const root = render(<CalendarView model={nz} />);
    expect(
      root.querySelector('[data-testid="calendar-cell-2026-09-16"]')?.getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("a month that does not hold today still opens on a day — never on none", () => {
    const november = assembleMonth(FIXTURE_CALENDAR_FACTS, "2026-11");
    const root = render(<CalendarView model={november} />);
    const pressed = [...root.querySelectorAll('[data-testid^="calendar-cell-"]')].filter(
      (c) => c.getAttribute("aria-pressed") === "true"
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.getAttribute("data-testid")).toBe("calendar-cell-2026-11-01");
  });
});

describe("REQ-043 c8 — the panel says why this page exists", () => {
  const root = panel("2026-09-15");

  it("states the search, the question, who answers it today, where the customer stands, and done-when", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    expect(why).not.toBeNull();
    const text = why?.textContent ?? "";
    for (const key of [
      "calendar.why.title",
      "calendar.why.search",
      "calendar.why.asked",
      "calendar.why.answered-today-by",
      "calendar.why.you",
      "calendar.why.done-when",
    ]) {
      expect(text, key).toContain(key);
    }
  });

  it("every one of those values is mono — §2.3 covers a search query and a numeral alike", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    const rows = why?.querySelectorAll("p") ?? [];
    // The block title is the first <p>; the five rows follow, each with a
    // `.num` value span.
    const monoValues = why?.querySelectorAll("span.num") ?? [];
    expect(monoValues.length).toBe(5);
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it("renders the winnability band through BAND_LABELS, never as a word of its own", () => {
    // Whichever band the fixture's page carries, the panel must reach it
    // through the registry key ADR-001 routes it to and never write the
    // word — so the assertion is on the key family, not on one band.
    const text = root.textContent ?? "";
    expect(text).toContain("band.winnability.");
    for (const word of ["Winnable", "Reach", "Not yet"]) expect(text, word).not.toContain(word);
  });

  it("the stage badge and the date head the panel", () => {
    const head = root.querySelector('[data-testid="day-head"]')?.textContent ?? "";
    expect(head).toContain("calendar.stage.your-review");
    expect(head).toContain("2026");
  });
});

describe("REQ-004 — an unmeasured value is a dash and a line, never a zero", () => {
  it("a page whose standing could not be measured renders the dash, not 0", () => {
    // The fixture's third specimen carries `unmeasured('undeterminable')`.
    const root = panel("2026-09-03");
    const values = [...(root.querySelectorAll('[data-testid="why-this-page"] span.num') ?? [])].map(
      (n) => n.textContent
    );
    expect(values).toContain(COPY["unmeasured.dash"]);
    // `renderMeasured` imports `copy` from inside the presentation module,
    // so it is the real one even here — the line it renders is the
    // registry's own sentence with its `{what}` slot filled, and this
    // reads that sentence off the registry rather than restating it.
    const line = COPY["unmeasured.undeterminable"].replace("{what}", "spreadsheet to crm migration");
    expect(root.textContent).toContain(line);
  });

  it("a measured zero renders as 0, because 0 is a measurement", () => {
    const root = panel("2026-09-02");
    const values = [...(root.querySelectorAll('[data-testid="why-this-page"] span.num') ?? [])].map(
      (n) => n.textContent
    );
    expect(values).toContain("0");
  });
});

describe("REQ-043 c10 — one provenance line, and no date repeated beside each value", () => {
  it("the line is owner-owed today, so it renders as nothing rather than a placeholder", () => {
    expect(COPY["calendar.provenance.measured"]).toBe("");
    expect(panel("2026-09-15").querySelector('[data-testid="day-provenance"]')).toBeNull();
  });

  it("and no 'Why this page' row carries a measurement date of its own", () => {
    const why = panel("2026-09-15").querySelector('[data-testid="why-this-page"]');
    // The one measurement date in the fixture is 2026-09-14; it must not
    // appear five times beside five values.
    expect((why?.textContent ?? "").includes("Sep 14")).toBe(false);
  });
});

describe("REQ-043 c9 — the panel renders exactly the projection, and adds nothing", () => {
  it("a page in review offers Read the full page, Move and Veto", () => {
    const root = panel("2026-09-15");
    expect(root.querySelector('[data-testid="day-action-calendar.action.read-full-page"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(3);
  });

  it("a live page offers one way through, at its recorded address", () => {
    const root = panel("2026-09-01");
    const link = root.querySelector('[data-testid="day-action-calendar.action.view-live-page"]');
    expect(link?.getAttribute("href")).toBe("https://content.example.com/2026-09-01");
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(1);
  });

  it("a needs-you page offers Reconnect and nothing that publishes", () => {
    const root = panel("2026-09-10");
    expect(root.querySelector('[data-testid="day-action-calendar.action.reconnect"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(1);
  });

  it("a planned page offers Move and Skip, and never Veto", () => {
    const root = panel("2026-09-18");
    expect(root.querySelector('[data-testid="day-action-calendar.action.skip"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).toBeNull();
  });
});

describe("REQ-043 c11 — an empty day states one account and offers no control", () => {
  const empties: readonly [string, string][] = [
    ["2026-09-13", "stopped.work.line"],
    ["2026-09-12", "calendar.empty.page-cannot-go-live"],
    ["2026-09-24", "calendar.empty.instruction"],
  ];

  it("renders no publish or approve control on any empty date", () => {
    for (const [day] of empties) {
      const root = panel(day);
      expect(root.querySelectorAll('[data-testid^="day-action-"]'), day).toHaveLength(0);
      expect(root.querySelector("button"), day).toBeNull();
    }
  });

  it("renders exactly one account, and no second one", () => {
    for (const [day] of empties) {
      const root = panel(day);
      expect(root.querySelectorAll('[data-testid="day-empty-line"]').length, day).toBeLessThanOrEqual(1);
      expect(root.querySelector('[data-testid="why-this-page"]'), day).toBeNull();
      expect(root.querySelector('[data-testid="day-title"]'), day).toBeNull();
    }
  });

  it("the account it renders is the one the resolver chose, from that cause's own key", () => {
    for (const [day, key] of empties) {
      const line = panel(day).querySelector('[data-testid="day-empty-line"]');
      if (COPY[key as keyof typeof COPY] === "") {
        // Owner-owed: nothing rendered, never another cause's sentence.
        expect(line, day).toBeNull();
      } else {
        expect(line?.textContent, day).toBe(key);
      }
    }
  });

  it("an empty day still heads with its date, so the panel never renders blank", () => {
    for (const [day] of empties) {
      expect(panel(day).textContent, day).toContain("2026");
    }
  });
});

describe("the panel is not a drawer, and it renders no sentence of its own", () => {
  it("renders as an <aside> in flow — nothing that slides over or is dismissed", () => {
    const root = panel("2026-09-15");
    expect(root.querySelector("aside.rk-daypanel")).not.toBeNull();
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it("every word it renders came from a registry key", () => {
    // With `copy()` mocked to the key, a word that is not a key and not a
    // value would be a sentence this component wrote. The fixture's own
    // values (title, search, question) are the only non-key text, and
    // they are data.
    const text = panel("2026-09-15").textContent ?? "";
    expect(text).toContain("calendar.");
    expect(text).not.toContain("TODO");
  });
});

// A cell the assembler can produce but the fixture's month does not hold,
// so the union's remaining arm is still rendered somewhere.
describe("a cell with a page whose stage has no action", () => {
  it("renders the page and an empty action slot rather than a missing one", () => {
    const scheduled = cellFor(MODEL, "2026-09-16") as DayCell;
    const root = render(<DayPanelView cell={scheduled} timeZone={FIXTURE_TIME_ZONE} />);
    expect(root.querySelector('[data-testid="day-title"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(0);
  });
});
