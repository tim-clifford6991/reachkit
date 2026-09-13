// tests/ui/settings-columns.test.ts — Canvas: Settings, §2.2
//
// Two claims about the Settings screen's arrangement, both carried by stock
// utilities rather than by a stylesheet of its own.
//
// 1. **It ships no CSS.** Custom CSS is allowed only for the calendar grid,
//    the day panel, the AI dot-matrix, chart SVGs and the sidebar. Settings
//    is on none of that list, so the check is that no stylesheet exists
//    under the screen's directory and that nothing there imports one.
//    Stated as a test rather than as a comment, because a comment is not
//    what stops the next person adding one.
//
// 2. **One column, at every band.** The artboard draws the cards in a single
//    column and the screen follows it, so the page declares no grid at all —
//    the two-column arrangement (and the `xl:` pin that expressed it) is
//    gone with the drawing it came from.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_DIR = path.resolve(import.meta.dirname, "../../src/app/(account)/app/settings");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const files = filesUnder(SETTINGS_DIR);

describe("§2.2 — Settings ships no stylesheet of its own", () => {
  it("no .css file exists under the screen's directory", () => {
    expect(files.filter((f) => f.endsWith(".css"))).toEqual([]);
  });

  it("and no file under it imports one", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/import\s+["'][^"']*\.css["']/);
    }
  });
});

describe("Canvas: Settings — the cards are one column", () => {
  const page = readFileSync(path.join(SETTINGS_DIR, "page.tsx"), "utf8");

  it("the screen declares no column grid: the artboard draws one column at every width", () => {
    expect(page).not.toMatch(/grid-cols-/);
  });
});
