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
// 2. **The seven tabs are a daisyUI `tabs` bar of links, and it cannot
//    overflow.** SPEC §4 (2026-09-20): "Settings is tabs: Your business,
//    Market and rivals, Publishing, Your voice, Mail, Billing, Account."
//    Until #925 this second claim was about §4.7's two columns and the
//    `xl:` variant they switched at; the columns are gone — seven tabs are
//    what replaced them — so what is pinned now is the construction that
//    replaced them, in the same shape: the bar is stock daisyUI, every tab
//    is an address rather than a widget, and seven words on a 390px screen
//    scroll sideways instead of pushing the screen wider
//    (`docs/DESIGN.md`'s no-overflow rule).
//
// **The file keeps its name** though the columns it was named for are gone.
// The tests still describe the Settings screen, and the name is what issues
// and pull requests already cite.
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

describe("SPEC §4 — the seven tabs are a daisyUI bar of addresses that cannot overflow", () => {
  const bar = readFileSync(path.join(SETTINGS_DIR, "SettingsTabs.tsx"), "utf8");

  it("the bar is stock daisyUI `tabs tabs-border` and marks the current tab with daisyUI's own class", () => {
    expect(bar).toMatch(/\btabs tabs-border\b/);
    expect(bar).toMatch(/\btab-active\b/);
  });

  it("every tab is an address: a link, never a button", () => {
    // Links, not buttons: the back button works between tabs, and nothing
    // here is a widget with state. Since SPEC §4's 2026-10-08 line (issue
    // 1341) the link is `next/link`, so the tab is loaded before the tap.
    expect(bar).toMatch(/<Link\b/);
    expect(bar).not.toMatch(/<button\b/);
    expect(bar).toMatch(/aria-current=/);
  });

  it("seven words wrap on a phone and scroll sideways from `sm` up, never widening the screen", () => {
    // `docs/DESIGN.md`: no element is wider than its container at 390. A
    // nav word cannot be clamped to an ellipsis and stay a nav word. Below
    // `sm` the bar wraps so no tab is hidden off-screen (#1101), each link a
    // 44px target; from `sm` up the row is the scroll container, the same
    // construction `OverviewTabs` is proven at. The layout suite renders all
    // seven and measures both.
    expect(bar).toMatch(/max-sm:flex-wrap/);
    expect(bar).toMatch(/max-sm:h-11/);
    expect(bar).toMatch(/min-w-0/);
    expect(bar).toMatch(/sm:overflow-x-auto/);
    expect(bar).toMatch(/sm:w-max/);
    expect(bar).toMatch(/sm:flex-nowrap/);
  });

  it("no tab draws two card columns — the columns are what the tabs replaced", () => {
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/grid-cols-2/);
    }
  });
});
