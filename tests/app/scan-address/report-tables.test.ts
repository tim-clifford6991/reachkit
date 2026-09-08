// tests/app/scan-address/report-tables.test.ts — BUILD §2.2, §4.1, issue #244
//
// §2.2, verbatim: "`table` (+zebra, always inside an `overflow-x-auto`
// wrap)". `src/ui/components/Table.tsx` carries that wrap itself — "the
// wrap is part of the component, not the caller's job" — so a module that
// renders a table through the component has it by construction.
//
// What the component cannot cover is a table the screen builds out of a
// grid. The report has two: the presence card's occupancy list (domain ·
// bar · share, one row per domain) and the free page card's label/value
// pairs. Neither is a `<table>`, and neither was inside a scroll wrap, so
// each was one long value away from a defect — which is how
// `rival-three.example.org` came to be drawn as `…example.o` / `rg` at
// 1024 and 1280 (the audit that opened #244).
//
// **The audit's own reading of the 320px report was wrong, and this file
// is where that is recorded.** It reported the report's tables as clipping
// "with no scroll container". All three are the registered `Table` inside
// `min-w-0 overflow-x-auto`, and what the screenshot showed was that wrap
// doing its job: content wider than the card, scrollable, which is exactly
// what §2.2 asks for and what the sweep's check 2 admits. The rows below
// assert that, so the claim is checked rather than remembered.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MODULES = path.resolve(
  import.meta.dirname,
  "../../../src/app/(public)/scan/[domain]/_modules"
);

const files = readdirSync(MODULES).filter((name) => name.endsWith(".tsx"));
const read = (name: string): string => readFileSync(path.join(MODULES, name), "utf8");

/** The wrap §2.2 requires, spelled the one way this codebase spells it —
 *  `min-w-0` beside it, because an `overflow-x-auto` box that cannot
 *  shrink never scrolls (`Table.tsx`'s own note, issue #13). */
const WRAP = /min-w-0 overflow-x-auto|overflow-x-auto min-w-0/;

/** Every `grid-cols-[…]` a file writes, as its track list. Split on `_` at
 *  the top level only, so `minmax(0,1fr)` counts as one track. */
function trackLists(source: string): string[][] {
  const lists: string[][] = [];
  for (const match of source.matchAll(/grid-cols-\[([^\]]+)\]/g)) {
    const body = match[1] ?? "";
    const tracks: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of body) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "_" && depth === 0) {
        tracks.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    if (current !== "") tracks.push(current);
    lists.push(tracks);
  }
  return lists;
}

/**
 * No named gap. #275 wrapped the free page card's label/value pair while
 * this branch was open, so every hand-built multi-column grid in
 * `_modules/` is inside the wrap and the list below is empty — which is
 * the state this rule was written to reach.
 *
 * It stays as a list rather than becoming an assertion of emptiness: the
 * next hand-built grid that needs a filed exception has somewhere to be
 * named, and the row beneath it fails on an entry that has since been
 * wrapped, so a stale exemption cannot sit here unnoticed.
 */
const NOT_YET_WRAPPED: ReadonlyArray<{ readonly file: string; readonly issue: string }> = [];

describe("§2.2 — a table on the report is the registered component, or is wrapped the same way", () => {
  it("the modules directory is actually read — a rule over nothing is not a rule", () => {
    expect(files.length).toBeGreaterThan(2);
  });

  it("no module writes a raw <table> — every table is the registered component", () => {
    for (const name of files) {
      expect(read(name), name).not.toMatch(/<table[\s>]/);
    }
  });

  it("the registered component brings the wrap, so a module that uses it needs none of its own", () => {
    const component = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/ui/components/Table.tsx"),
      "utf8"
    );
    expect(component).toMatch(WRAP);
    // And it has no prop to leave the wrap off.
    expect(component).not.toMatch(/wrap\??:/);
  });

  it("every hand-built multi-column grid sits inside the wrap, or is a named gap", () => {
    const unwrapped: string[] = [];
    for (const name of files) {
      const source = read(name);
      const multi = trackLists(source).filter((tracks) => tracks.length > 1);
      if (multi.length === 0) continue;
      if (WRAP.test(source)) continue;
      unwrapped.push(name);
    }
    expect(unwrapped.sort()).toEqual(NOT_YET_WRAPPED.map((entry) => entry.file).sort());
  });

  it("every named gap still is one, and names the issue that closes it", () => {
    // A stale exemption reads as a rule with a known hole while the hole
    // has already been filled. This row fails on an entry that has since
    // been wrapped.
    for (const entry of NOT_YET_WRAPPED) {
      expect(files, entry.file).toContain(entry.file);
      const source = read(entry.file);
      expect(trackLists(source).some((tracks) => tracks.length > 1), entry.file).toBe(true);
      expect(WRAP.test(source), `${entry.file} is wrapped now — drop its entry`).toBe(false);
      expect(entry.issue).toMatch(/^#\d+$/);
    }
  });

  it("the module grids align their cards to the start, so a shorter card keeps its height", () => {
    // daisyUI's own rule is `.card-body p { flex-grow: 1 }`, so a card the
    // grid stretched to a taller sibling hands the slack to its
    // paragraphs: one line of text became a 399px band on the presence
    // card at 1280, and the legend under it another 393px. `items-start`
    // is the half of the fix that stops the stretch.
    const view = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(public)/scan/[domain]/_address/report-view.tsx"),
      "utf8"
    );
    // The report lays its modules out on the arm's own tracks since #258:
    // `<main>` spans them and `grid-cols-subgrid` puts each row on those
    // tracks, so the two-up cards are siblings in one row. Every grid that
    // can hold two cards side by side has to align them to the start.
    const grids = [...view.matchAll(/className="[^"]*grid[^"]*(?:subgrid|grid-cols-2)[^"]*"/g)].map(
      (m) => m[0]
    );
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) expect(grid, grid).toContain("items-start");
  });

  it("a card's content starts at the top even when the card is stretched", () => {
    // The other half, and the reason it is stated in the component: a
    // future grid, or an `h-full` wrapper, stretches a card again, and the
    // rule that its content starts at the top is not a per-screen choice.
    const card = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/ui/components/Card.tsx"),
      "utf8"
    );
    expect(card).toMatch(/card-body[^"]*\[&>p\]:grow-0/);
  });

  it("the presence card's occupancy is the registered drawing, inside a declared scroll container", () => {
    // The hand-built occupancy row is gone (issue #352): the domains, the
    // bars and the counts are `PresenceBars`, §2.4's own drawing of this
    // card's figure, and the wrap this row used to check on one domain
    // cell is now around the chart — a drawing fills the box it is given,
    // and a box that cannot shrink below its content never scrolls. What
    // the cell wrap protected holds by construction now: a `<text>` in a
    // viewBox has no line box to be broken across.
    const source = read("google-presence.tsx");
    expect(WRAP.test(source)).toBe(true);
    expect(source).toContain("<PresenceBars");
    const wrapIndex = source.search(WRAP);
    expect(wrapIndex).toBeGreaterThan(-1);
    expect(source.indexOf("<PresenceBars")).toBeGreaterThan(wrapIndex);
    // And no hand-built row grid came back with it.
    expect(trackLists(source).filter((tracks) => tracks.length > 1)).toEqual([]);
  });
});
