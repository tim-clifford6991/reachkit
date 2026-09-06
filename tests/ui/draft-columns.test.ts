// tests/ui/draft-columns.test.ts — BUILD §4.6, §2.2, ADR-093
//
// Two claims about the draft view's arrangement, on exactly the footing
// `settings-columns.test.ts` holds the same two for §4.7.
//
// 1. **It ships no CSS.** §2.2: "Custom CSS is allowed only for: the
//    calendar grid, the day panel, the AI dot-matrix, chart SVGs, and the
//    sidebar — nothing else." A draft body is on none of that list, so the
//    check is that no stylesheet exists under the screen's directory and
//    that nothing there imports one. Stated as a test rather than as a
//    comment, because a comment is not what stops the next person adding
//    one.
//
// 2. **§4.6's two columns arrive at `BAND_MIN.wide`, and below it the two
//    panes are tabbed.** §4.6: "two columns on desktop, tabbed on mobile".
//    The switch is Tailwind's `xl:` variant, whose breakpoint is 80rem —
//    1280px at the 16px root, which is `BAND_MIN.wide` and
//    `--breakpoint-xl`. Not `lg:`: that is where the sidebar returns, and
//    an editor and a preview beside it would each be narrower than the
//    compact band.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";

const DRAFT_DIR = path.resolve(import.meta.dirname, "../../src/app/(account)/app/draft");
const TAILWIND_THEME = path.resolve(import.meta.dirname, "../../node_modules/tailwindcss/theme.css");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

const files = filesUnder(DRAFT_DIR);

describe("BUILD §2.2 — the draft view ships no stylesheet of its own", () => {
  it("no .css file exists under the screen's directory", () => {
    expect(files.filter((f) => f.endsWith(".css"))).toEqual([]);
  });

  it("and no file under it imports one", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/import\s+["'][^"']*\.css["']/);
    }
  });
});

describe("§4.6's editor and preview: two columns at BAND_MIN.wide, tabbed below it", () => {
  const editor = readFileSync(path.join(DRAFT_DIR, "[draftId]", "Editor.tsx"), "utf8");

  it("the editor declares one column, and two only at the `xl:` variant", () => {
    expect(editor).toMatch(/grid-cols-1/);
    expect(editor).toMatch(/xl:grid-cols-2/);
    expect(editor).not.toMatch(/lg:grid-cols-/);
  });

  it("the tab bar is drawn below that boundary and hidden at it", () => {
    expect(editor).toMatch(/xl:hidden/);
  });

  it("each pane is hidden below the boundary unless it is the selected tab, and shown at it", () => {
    expect(editor).toMatch(/hidden xl:block/);
  });

  it("Tailwind's `xl` breakpoint is BAND_MIN.wide, which is what lets a utility express the token", () => {
    expect(existsSync(TAILWIND_THEME)).toBe(true);
    const theme = readFileSync(TAILWIND_THEME, "utf8");
    const match = /--breakpoint-xl:\s*([0-9.]+)rem/.exec(theme);
    expect(match, "tailwindcss/theme.css declares no --breakpoint-xl").not.toBeNull();
    expect(Number(match?.[1]) * 16).toBe(BAND_MIN.wide);
  });
});
