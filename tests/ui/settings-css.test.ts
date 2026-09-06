// tests/ui/settings-css.test.ts — BUILD §4.7, §2.2, ADR-093
//
// `src/app/(account)/app/settings/settings.css` is the settings screen's
// arrangement — the two columns §4.7 opens with, and the rows inside them. One
// number in it is a layout token's value, and a media query prelude cannot read
// a `var()` (see `layout.css`'s own header), so it is written literally there
// and pinned back here against `BAND_MIN` — the shape `tests/ui/shell-css.test.ts`
// and `tests/ui/layout-tokens.test.ts` already use for the same reason.
//
// The second assertion is the one that keeps §2.2 honest. "Custom CSS is
// allowed only for: the calendar grid, the day panel, the AI dot-matrix, chart
// SVGs, and the sidebar — nothing else", and Settings is on none of that list.
// What makes this sheet compatible with that rule is that it styles no
// registered component: it must not carry a rule whose selector reaches
// `.card`, `.btn`, `.badge`, `.toggle`, `.input`, `.alert`, `.stat`, `.tabs`,
// `.table`, `.progress`, `.steps`, `.join`, `.collapse`, `.divider` or `.kbd`.
// Those are daisyUI's, mapped onto this product's tokens in
// `tailwind.config.ts`, and this screen waits for that pipeline rather than
// hand-drawing a second copy of it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";

const SETTINGS_CSS_PATH = path.resolve(
  import.meta.dirname,
  "../../src/app/(account)/app/settings/settings.css"
);
const SETTINGS_PAGE_PATH = path.resolve(
  import.meta.dirname,
  "../../src/app/(account)/app/settings/page.tsx"
);

const css = readFileSync(SETTINGS_CSS_PATH, "utf8");

describe("the column switch is BAND_MIN.wide, written once and pinned", () => {
  it("declares its two-column rule at exactly --breakpoint-xl", () => {
    const preludes = [...css.matchAll(/@media\s*\(min-width:\s*(\d+)px\)/g)].map((m) => Number(m[1]));
    expect(preludes.length).toBeGreaterThan(0);
    for (const width of preludes) {
      expect(width).toBe(BAND_MIN.wide);
    }
  });

  it("the two columns §4.7 opens with are what that query turns on", () => {
    const wide = css.slice(css.indexOf(`@media (min-width: ${BAND_MIN.wide}px)`));
    expect(wide).toMatch(/grid-template-columns:\s*1fr 1fr/);
  });

  it("and one column is the state below it, so the compact band is never two", () => {
    const base = css.slice(0, css.indexOf("@media"));
    expect(base).toMatch(/\.rk-settings-cols\s*\{[^}]*grid-template-columns:\s*1fr;/);
  });
});

describe("BUILD §2.2 — the sheet styles no registered component", () => {
  const REGISTERED = [
    "btn",
    "card",
    "badge",
    "alert",
    "stat",
    "tabs",
    "table",
    "progress",
    "toggle",
    "steps",
    "join",
    "collapse",
    "input",
    "divider",
    "kbd",
  ];

  /** Selector text only — the file's prose says these words often and should. */
  const selectors = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .map((block) => block.split("{")[0])
    .join(" ");

  it("no rule's selector reaches a daisyUI component class", () => {
    for (const name of REGISTERED) {
      expect(selectors, name).not.toMatch(new RegExp(`\\.${name}(?![a-zA-Z0-9_-])`));
    }
  });

  it("every rule it does carry is scoped to this screen", () => {
    for (const selector of selectors.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (selector.startsWith("@")) continue;
      expect(selector, selector).toMatch(/(^|\s)\.rk-settings/);
    }
  });
});

describe("the screen imports its own sheet, so the rules reach the route", () => {
  it("page.tsx imports ./settings.css", () => {
    expect(readFileSync(SETTINGS_PAGE_PATH, "utf8")).toMatch(/import\s+["']\.\/settings\.css["']/);
  });
});
