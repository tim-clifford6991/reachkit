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
    const offenders = files.flatMap((file) =>
      openingTags(readFileSync(file, "utf8"))
        .map((tag) => columnsOffence(tag))
        .filter((offence): offence is string => offence !== null)
        .map((offence) => `${path.basename(file)}: ${offence}`)
    );
    expect(offenders).toEqual([]);
  });

  it("the rule refuses two card columns, a week without its phone tracks, and columns on a card (E38)", () => {
    expect(columnsOffence('<div className="grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">')).not.toBeNull();
    expect(columnsOffence('<div className="grid min-w-0 grid-cols-7 gap-1" data-layout="week">')).not.toBeNull();
    expect(columnsOffence('<section className="card grid grid-cols-1 md:grid-cols-2" data-layout="pair">')).not.toBeNull();
    expect(columnsOffence('<ol className="grid grid-cols-1 md:grid-cols-3" data-layout="columns">')).not.toBeNull();
    expect(columnsOffence('<div className="grid min-w-0 grid-cols-4 gap-1 md:grid-cols-7" data-layout="week">')).toBeNull();
  });
});

// E38: inside one card or fold, columns only on a tag naming its layout, with exactly that layout's classes.
const LAYOUTS: Readonly<Record<string, readonly string[]>> = {
  pair: ["grid-cols-1", "md:grid-cols-2"],
  choices: ["grid-cols-1", "md:grid-cols-2", "xl:grid-cols-4"],
  steps: ["grid-cols-1", "md:grid-cols-3"],
  compare: ["grid-cols-1", "md:grid-cols-3"],
  week: ["grid-cols-4", "md:grid-cols-7"],
};
const COLUMNS = /(?:^|\s)(?:[a-z0-9]+:)*grid-cols-(?:[2-9]|1[0-2]|\[|\()/;
const GRID_COLS = /^(?:[a-z0-9]+:)*grid-cols-/;

/** Why one opening tag breaks the rule, or `null` where it keeps it. */
function columnsOffence(tag: string): string | null {
  const classes = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(tag);
  const className = classes?.[1] ?? classes?.[2] ?? "";
  if (!COLUMNS.test(className)) return null;
  const layout = /data-layout="([^"]*)"/.exec(tag)?.[1];
  const allowed = layout === undefined ? undefined : LAYOUTS[layout];
  if (allowed === undefined) return `columns without an allowed data-layout: ${tag}`;
  if (/(?:^|\s)card(?:\s|$)/.test(className)) return `columns on a card: ${tag}`;
  const held = className.split(/\s+/).filter((c) => GRID_COLS.test(c)).sort();
  if (held.join(" ") !== [...allowed].sort().join(" ")) return `${layout} is ${allowed.join(" ")}, not ${held.join(" ")}: ${tag}`;
  return null;
}

/** Each JSX opening tag in a source file, braces and quotes respected, so `=>` inside one does not end it. */
function openingTags(source: string): string[] {
  const tags: string[] = [];
  for (let i = source.indexOf("<"); i !== -1; i = source.indexOf("<", i + 1)) {
    if (!/[A-Za-z]/.test(source[i + 1] ?? "")) continue;
    let depth = 0;
    let quote: string | null = null;
    for (let j = i + 1; j < source.length; j++) {
      const c = source[j]!;
      if (quote !== null) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        tags.push(source.slice(i, j + 1));
        break;
      }
    }
  }
  return tags;
}
