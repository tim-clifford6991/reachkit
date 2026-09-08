// tests/app/calendar/month-switcher.test.ts — BUILD §4.6's month switcher
// (issue #269).
//
// The audit found it at 320 as three bare mono strings wrapping to two
// lines with nothing marking which month you were on. It is a `join` now,
// and what this file holds is the two properties the shape has to keep:
//
//  1. **The neighbours navigate.** They are `<a href>` carrying `?month=`,
//     so the month is in the address — linkable, shareable, and rendered by
//     a server component with no client runtime. A `Tabs` would make them
//     buttons with an `onSelect` and take all three away; the row below
//     fails if anyone converts them.
//  2. **The current month is marked, and is not a control.** A link to
//     where you already are is a control that does nothing.
//
// The labels themselves are asserted through `dates.ts` rather than through
// the rendered page: `monthLabel` and `monthNameOnly` are the two
// formatters, and which one each position takes is the whole of why the row
// fits 320.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addMonths, monthLabel, monthNameOnly } from "@/app/(account)/app/calendar/dates";

const PAGE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/app/(account)/app/calendar/page.tsx"),
  "utf8"
);

const MONTH = "2026-09";

describe("the two formatters, and which position takes which", () => {
  it("the month you are on carries its year; a neighbour carries only its name", () => {
    expect(monthLabel(MONTH)).toBe("September 2026");
    expect(monthNameOnly(MONTH)).toBe("Sep");
  });

  it("**three full labels are what did not fit** — the neighbours are the short form", () => {
    // The finding, as arithmetic rather than as a screenshot: the two
    // neighbours together are now shorter than a single full label, so
    // dropping the year from both saves more than a whole label's width —
    // which is the room the row needed at 320.
    const neighbours =
      monthNameOnly(addMonths(MONTH, -1)).length + monthNameOnly(addMonths(MONTH, 1)).length;
    expect(neighbours).toBeLessThan(monthLabel(MONTH).length);
  });

  it("a neighbour's name is unambiguous across the year boundary", () => {
    expect(monthNameOnly(addMonths("2026-01", -1))).toBe("Dec");
    expect(monthNameOnly(addMonths("2026-12", 1))).toBe("Jan");
  });
});

describe("the switcher's shape", () => {
  it("it is a `join` of three items", () => {
    expect(PAGE).toContain('className="join" data-testid="month-switcher"');
    expect(PAGE.split("join-item").length - 1).toBe(3);
  });

  it("**the neighbours are links carrying the month in the address**", () => {
    for (const id of ["month-previous", "month-next"]) {
      const at = PAGE.indexOf(`data-testid="${id}"`);
      expect(at, id).toBeGreaterThan(-1);
      // The element that opens before that test id is an anchor with an
      // `?month=` href — never a `<button>`, which is what a `Tabs` would
      // have made it.
      const element = PAGE.slice(PAGE.lastIndexOf("<", at), at);
      expect(element, id).toContain("<a");
      expect(element, id).toContain("/app/calendar?month=");
    }
  });

  it("**the current month is marked and is not a link**", () => {
    const at = PAGE.indexOf('data-testid="month-current"');
    const element = PAGE.slice(PAGE.lastIndexOf("<", at), at);
    expect(element).toContain("<span");
    expect(element).not.toContain("<a");
    expect(element).toContain('aria-current="page"');
    // Marked by more than tone (§2.5): the active class and the ARIA state
    // are two readings of the same fact, for two kinds of reader.
    expect(element).toContain("btn-active");
  });

  it("the neighbours take the short label and the current one the long", () => {
    expect(PAGE).toContain("{monthNameOnly(previous)}");
    expect(PAGE).toContain("{monthLabel(month)}");
    expect(PAGE).toContain("{monthNameOnly(next)}");
  });

  it("numerals stay mono — a month and its year are values (§2.3)", () => {
    expect(PAGE.split("join-item btn btn-sm num").length - 1).toBeGreaterThanOrEqual(2);
    expect(PAGE).toContain("btn-active num");
  });
});
