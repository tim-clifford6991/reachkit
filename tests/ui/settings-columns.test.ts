// tests/ui/settings-columns.test.ts — BUILD §4.7, §2.2, ADR-093
//
// Two claims about the Settings screen's arrangement, both of which used to be
// carried by a stylesheet of its own and are now carried by stock utilities.
//
// 1. **It ships no CSS.** §2.2: "Custom CSS is allowed only for: the calendar
//    grid, the day panel, the AI dot-matrix, chart SVGs, and the sidebar —
//    nothing else." Settings is on none of that list, so the check is simply
//    that no stylesheet exists under the screen's directory and that nothing
//    there imports one. Stated as a test rather than as a comment, because a
//    comment is not what stops the next person adding one (`CLAUDE.md`: "If you
//    care about a rule and no check enforces it, add the check").
//
// 2. **§4.7's two columns arrive at `BAND_MIN.wide`.** The switch is Tailwind's
//    `xl:` variant, whose breakpoint is 80rem — 1280px at the 16px root, which
//    is `BAND_MIN.wide` and `--breakpoint-xl`. That coincidence is load-bearing
//    (it is why a utility can express a design-token boundary at all), so it is
//    pinned here against both `BAND_MIN` and Tailwind's own theme file, in the
//    `tests/pins.test.ts` shape. If a future Tailwind moved `xl`, this fails
//    rather than the screen silently reflowing at a width nothing specified.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";

const SETTINGS_DIR = path.resolve(import.meta.dirname, "../../src/app/(account)/app/settings");
const TAILWIND_THEME = path.resolve(import.meta.dirname, "../../node_modules/tailwindcss/theme.css");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const files = filesUnder(SETTINGS_DIR);

describe("BUILD §2.2 — Settings ships no stylesheet of its own", () => {
  it("no .css file exists under the screen's directory", () => {
    expect(files.filter((f) => f.endsWith(".css"))).toEqual([]);
  });

  it("and no file under it imports one", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/import\s+["'][^"']*\.css["']/);
    }
  });
});

describe("§4.7's two columns arrive at BAND_MIN.wide", () => {
  const page = readFileSync(path.join(SETTINGS_DIR, "page.tsx"), "utf8");

  it("the screen declares one column, and two only at the `xl:` variant", () => {
    expect(page).toMatch(/grid-cols-1/);
    expect(page).toMatch(/xl:grid-cols-2/);
    // Not `lg:` — that is where the sidebar returns, and two card columns
    // beside it would be narrower than the compact band (ADR-093).
    expect(page).not.toMatch(/lg:grid-cols-/);
  });

  it("Tailwind's `xl` breakpoint is BAND_MIN.wide, which is what lets a utility express the token", () => {
    expect(existsSync(TAILWIND_THEME)).toBe(true);
    const theme = readFileSync(TAILWIND_THEME, "utf8");
    const match = /--breakpoint-xl:\s*([0-9.]+)rem/.exec(theme);
    expect(match, "tailwindcss/theme.css declares no --breakpoint-xl").not.toBeNull();
    // The root font size is 16px: `src/ui/type.css` sets `font-size` on `body`,
    // never on `html`, so `rem` is the browser default here.
    expect(Number(match?.[1]) * 16).toBe(BAND_MIN.wide);
  });
});
