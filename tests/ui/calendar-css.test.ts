// tests/ui/calendar-css.test.ts — BUILD §2.2, §4.6, ADR-093
//
// The two custom surfaces issue #16 adds carry numbers a media query
// prelude cannot read from a `var()`, so they are written literally in CSS
// and pinned back here against the module that declares them — the same
// shape `tests/ui/shell-css.test.ts` uses for the sidebar's own breakpoint.
//
// Also asserts the one rule §4.6 calls load-bearing in terms: the grid's
// `minmax(0, 1fr)`. A `repeat(7, 1fr)` gives every column a min-content
// floor, and one long unbroken word then pushes the whole grid past its
// container — check 1 of ADR-093 decision 6's sweep, and the single most
// likely "simplification" of this file.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";

const CUSTOM_DIR = path.resolve(__dirname, "../../src/ui/components/custom");
const GRID_CSS = readFileSync(path.join(CUSTOM_DIR, "calendar-grid.css"), "utf8");
const PANEL_CSS = readFileSync(path.join(CUSTOM_DIR, "day-panel.css"), "utf8");
function declarations(css: string): Declaration[] {
  const out: Declaration[] = [];
  postcss.parse(css).walkDecls((d) => {
    out.push(d);
  });
  return out;
}

function mediaPreludes(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkAtRules("media", (r: AtRule) => {
    out.push(r.params);
  });
  return out;
}

function declared(css: string, prop: string): string | undefined {
  return declarations(css).find((d) => d.prop === prop)?.value;
}

describe('BUILD §4.6 — "repeat(7,minmax(0,1fr)) — the minmax is load-bearing"', () => {
  it("--grid-week is exactly §4.6's value", () => {
    expect(declared(GRID_CSS, "--grid-week")).toBe("repeat(7, minmax(0, 1fr))");
  });

  it("the head and the grid both take their columns from that one token", () => {
    const templates = declarations(GRID_CSS).filter((d) => d.prop === "grid-template-columns");
    expect(templates.length).toBeGreaterThanOrEqual(1);
    expect(templates[0]?.value).toBe("var(--grid-week)");
    // One rule sets it for both, so the seven column heads and the seven
    // columns cannot disagree about how many there are.
    const rules: string[] = [];
    postcss.parse(GRID_CSS).walkRules((r: Rule) => {
      if (r.toString().includes("var(--grid-week)")) rules.push(r.selector);
    });
    expect(rules[0]).toContain(".rk-cal-head");
    expect(rules[0]).toContain(".rk-cal-grid");
  });

  it("no declaration anywhere is a bare repeat(7, 1fr) — the mutation this file exists to catch", () => {
    // Over declarations, not raw text: the header comment names the wrong
    // form on purpose, to say why it is wrong.
    for (const decl of declarations(GRID_CSS)) {
      expect(decl.value, `${decl.prop}: ${decl.value}`).not.toMatch(/repeat\(\s*7\s*,\s*1fr\s*\)/);
    }
  });

  it("the cell wraps rather than clips, so the type is never shrunk to fit (ADR-093 d2)", () => {
    const cell = declarations(GRID_CSS).filter((d) => d.parent?.toString().includes(".rk-cal-cell"));
    expect(cell.some((d) => d.prop === "overflow-wrap" && d.value === "anywhere")).toBe(true);
    expect(cell.some((d) => d.prop === "height")).toBe(false);
    expect(cell.some((d) => d.prop === "overflow" && d.value === "hidden")).toBe(false);
  });
});

describe("design/tokens.md §2b — the two breakpoints, pinned against BAND_MIN", () => {
  it("the grid becomes seven rows below --breakpoint-md (768px)", () => {
    // 768 is design/tokens.md §2b's own derivation — 7 × --w-cell-min +
    // 6 × --s-1 + 2 × --s-4 = 728, rounded up to the named step. It is not
    // a band boundary, so `BAND_MIN` has nothing to pin it to; what is
    // pinned is that the query is `max-width: 767px` — the boundary minus
    // one pixel, which is where the off-by-one lives.
    expect(mediaPreludes(GRID_CSS)).toEqual(["(max-width: 767px)"]);
    expect(declared(GRID_CSS, "--w-cell-min")).toBe("96px");
    expect(7 * 96 + 6 * 4 + 2 * 16).toBeLessThanOrEqual(768);
  });

  it("the day panel sits beside the grid at --breakpoint-xl, which is BAND_MIN.wide", () => {
    expect(mediaPreludes(PANEL_CSS)).toEqual([`(min-width: ${BAND_MIN.wide}px)`]);
  });

  it("the panel is 290px — §4.6's own number — and neither grows nor shrinks", () => {
    expect(declared(PANEL_CSS, "--w-day-panel")).toBe("290px");
    expect(PANEL_CSS).toContain("flex: 0 0 var(--w-day-panel)");
  });

  it("and 222 + 48 + 696 + 16 + 290 fits inside BAND_MIN.wide (the derivation itself)", () => {
    expect(222 + 48 + 696 + 16 + 290).toBeLessThanOrEqual(BAND_MIN.wide);
  });
});

describe('§4.6 — the panel is "not a drawer", at any width', () => {
  it("is sticky only at and above the wide band, and in flow below it", () => {
    const sticky = declarations(PANEL_CSS).filter(
      (d) => d.prop === "position" && d.value === "sticky"
    );
    expect(sticky).toHaveLength(1);
    // The one sticky declaration sits inside the min-width query and
    // nowhere else, so below it the panel simply follows the grid.
    expect(sticky[0]?.parent?.parent?.toString()).toContain(`min-width: ${BAND_MIN.wide}px`);
  });

  it("nothing here positions the panel over the page", () => {
    for (const value of ["fixed", "absolute"]) {
      expect(
        declarations(PANEL_CSS).some((d) => d.prop === "position" && d.value === value),
        value
      ).toBe(false);
    }
    expect(PANEL_CSS).not.toContain("transform:");
    expect(PANEL_CSS).not.toContain("z-index");
  });
});

describe("ADR-093 decision 3 — nothing in either sheet is written below the type floor", () => {
  // `src/ui/layout/layout.css` declares `--t-floor` and
  // `tests/ui/layout-tokens.test.ts` pins its value; what is asserted here
  // is that these two sheets obey it — "a box that cannot fit its text at
  // the floor gets more room, wraps, or clamps", never a smaller step.
  it("every font-size is the floor token itself, or a literal at or above it", () => {
    for (const [name, css] of [
      ["calendar-grid.css", GRID_CSS],
      ["day-panel.css", PANEL_CSS],
    ] as const) {
      const sizes = declarations(css).filter((d) => d.prop === "font-size");
      for (const decl of sizes) {
        const px = /^(\d+(?:\.\d+)?)px$/.exec(decl.value);
        if (px) expect(Number(px[1]), `${name}: ${decl.value}`).toBeGreaterThanOrEqual(11);
        else expect(decl.value, name).toBe("var(--t-floor)");
      }
    }
  });
});

describe("BUILD §2.2 — custom CSS exists for these two surfaces and no third", () => {
  it("every rule in each sheet is scoped to that surface's own class prefix", () => {
    for (const [name, css, prefixes] of [
      ["calendar-grid.css", GRID_CSS, [".rk-cal"]],
      ["day-panel.css", PANEL_CSS, [".rk-daypanel", ".rk-day-layout"]],
    ] as const) {
      postcss.parse(css).walkRules((r: Rule) => {
        for (const selector of r.selector.split(",").map((s) => s.trim())) {
          expect(
            prefixes.some((p) => selector.startsWith(p)),
            `${name}: ${selector}`
          ).toBe(true);
        }
      });
    }
  });
});
