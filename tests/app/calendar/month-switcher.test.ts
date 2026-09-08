// tests/app/calendar/month-switcher.test.ts — BUILD §4.6's month switcher
// (issue #269).
//
// The audit found it at 320 as three bare mono strings wrapping to two
// lines with nothing marking which month you were on. Since #354 it is the
// approved S14's own shape — `← Sep 2026 →`, two quiet arrow pills with
// the month between them — which answers that finding a second and better
// way: the row carries ONE label instead of three, so there is nothing
// left to wrap and nothing to mistake for the month you are on.
//
// What this file holds is the two properties the shape has to keep:
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
// the rendered page: `monthShortLabel` is what the row shows and
// `monthNameOnly` is what a screen reader hears on each arrow, and which
// one each position takes is the whole of why the row fits 320.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addMonths,
  monthLabel,
  monthNameOnly,
  monthShortLabel,
} from "@/app/(account)/app/calendar/dates";

const PAGE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/app/(account)/app/calendar/page.tsx"),
  "utf8"
);

const MONTH = "2026-09";

describe("the two formatters, and which position takes which", () => {
  it("the month you are on is short and carries its year; a neighbour is its name alone", () => {
    expect(monthShortLabel(MONTH)).toBe("Sep 2026");
    expect(monthNameOnly(MONTH)).toBe("Sep");
    // `monthLabel` is unchanged and still the long form — other callers
    // name a month as itself and want it.
    expect(monthLabel(MONTH)).toBe("September 2026");
  });

  it("**three labels are what did not fit** — the row now carries one", () => {
    // The finding, as arithmetic rather than as a screenshot. The row used
    // to print three month labels side by side; it prints one, and the two
    // neighbours are arrows whose names are read rather than drawn.
    expect(monthShortLabel(MONTH).length).toBeLessThan(monthLabel(MONTH).length);
    const three =
      monthNameOnly(addMonths(MONTH, -1)).length +
      monthLabel(MONTH).length +
      monthNameOnly(addMonths(MONTH, 1)).length;
    expect(monthShortLabel(MONTH).length).toBeLessThan(three / 2);
  });

  it("a neighbour's name is unambiguous across the year boundary", () => {
    expect(monthNameOnly(addMonths("2026-01", -1))).toBe("Dec");
    expect(monthNameOnly(addMonths("2026-12", 1))).toBe("Jan");
  });
});

describe("the switcher's shape", () => {
  it("it is the approved row of three: an arrow, the month, an arrow (#354)", () => {
    expect(PAGE).toContain('data-testid="month-switcher"');
    // Not a `join` any more. A `join` welds its children edge to edge and
    // does not wrap; what the approved S14 draws is two quiet pills with
    // the month standing between them, so the arrows read as controls and
    // the month reads as a label rather than a third button.
    expect(PAGE).not.toContain("join-item");
    // The arrows are fixed glyphs — a direction, not a sentence — so they
    // are named constants rather than registry keys, on the footing
    // `Stat`'s em dash already stands on. Named constants and not bare JSX
    // text: the string-literal sweep governs `src/app/**` and does not
    // read a glyph differently from a sentence, rightly.
    for (const glyph of ["PREVIOUS_GLYPH", "NEXT_GLYPH"]) {
      expect(PAGE, glyph).toContain(`const ${glyph} = "\\u21`);
      expect(PAGE, glyph).toContain(`{${glyph}}`);
    }
  });

  it("**an arrow is never a glyph alone** — the month it goes to is its accessible name", () => {
    // A control whose whole content is a glyph has no name at all. The
    // name needs no registry key: a month is a value, not a sentence
    // (§2.3), which is the same reason the row it sits in never needed
    // one. `aria-label` and not an off-screen span — `sr-only` is an
    // absolutely positioned, clipped box, and the layout sweep reads it as
    // an element escaping its parent and as text cut off, both correctly.
    for (const [id, formatter] of [
      ["month-previous", "monthNameOnly(previous)"],
      ["month-next", "monthNameOnly(next)"],
    ] as const) {
      const at = PAGE.indexOf(`data-testid="${id}"`);
      const opens = PAGE.lastIndexOf("<a", at);
      const anchor = PAGE.slice(opens, PAGE.indexOf("</a>", at));
      expect(anchor, id).toContain(`aria-label={${formatter}}`);
      // The glyph is the anchor's whole content, and the label is what
      // names it — no second, off-screen copy of the month.
      expect(anchor, id).not.toContain("className=\"sr-only");
    }
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
    // Marked by more than tone (§2.5): the weight and the ARIA state are
    // two readings of the same fact, for two kinds of reader.
    expect(element).toContain("font-semibold");
  });

  it("the row shows the short label and the arrows are named by their neighbours", () => {
    expect(PAGE).toContain("{monthNameOnly(previous)}");
    expect(PAGE).toContain("{monthShortLabel(month)}");
    expect(PAGE).toContain("{monthNameOnly(next)}");
  });

  it("numerals stay mono — a month and its year are values (§2.3)", () => {
    const at = PAGE.indexOf('data-testid="month-current"');
    expect(PAGE.slice(PAGE.lastIndexOf("<", at), at)).toContain("num");
  });
});
