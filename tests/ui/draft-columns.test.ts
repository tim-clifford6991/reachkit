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
// 2. **The two columns arrive at `BAND_MIN.medium`, and below it the two
//    panes are tabbed.** §4.6 says only "two columns on desktop, tabbed on
//    mobile"; UI-SPEC S17 is specific — "two columns ≥1024, tabbed below" —
//    and §1 of that document rules that where it and BUILD §4 differ, it
//    wins until the §4 amendment lands. So the switch is Tailwind's `lg:`
//    variant, whose breakpoint is 64rem — 1024px at the 16px root, which is
//    `BAND_MIN.medium` and `--breakpoint-lg`.
//
//    It was `xl:` until issue #355, on the argument that 1024 is where the
//    sidebar returns and two panes beside it would each be narrower than
//    the compact band. That is arithmetically true (1024 − 222 − gutters,
//    halved, is about 370) and the set draws it anyway: a Markdown pane and
//    its preview are columns of text, not cards of modules, and a customer
//    editing at 1024 should not have to tab between what they type and what
//    it becomes.
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

describe("S17's editor and preview: two columns at BAND_MIN.medium, tabbed below it", () => {
  const editor = readFileSync(path.join(DRAFT_DIR, "[draftId]", "Editor.tsx"), "utf8");

  it("the editor declares one column, and two only at the `lg:` variant", () => {
    expect(editor).toMatch(/grid-cols-1/);
    expect(editor).toMatch(/lg:grid-cols-2/);
    expect(editor).not.toMatch(/xl:grid-cols-/);
  });

  it("the tab bar is drawn below that boundary and hidden at it", () => {
    expect(editor).toMatch(/lg:hidden/);
  });

  it("each pane is hidden below the boundary unless it is the selected tab, and shown at it", () => {
    expect(editor).toMatch(/hidden lg:block/);
  });

  it("Tailwind's `lg` breakpoint is BAND_MIN.medium, which is what lets a utility express the token", () => {
    expect(existsSync(TAILWIND_THEME)).toBe(true);
    const theme = readFileSync(TAILWIND_THEME, "utf8");
    const match = /--breakpoint-lg:\s*([0-9.]+)rem/.exec(theme);
    expect(match, "tailwindcss/theme.css declares no --breakpoint-lg").not.toBeNull();
    expect(Number(match?.[1]) * 16).toBe(BAND_MIN.medium);
  });
});
