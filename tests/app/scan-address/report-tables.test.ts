// tests/app/scan-address/report-tables.test.ts — BUILD §2.2, §4.1, issue #244
//
// A daisyUI `table` is written in the route (DESIGN rule 1, #626), always
// inside an `overflow-x-auto` wrap, so a module that writes one says so.
//
// What a table cannot cover is a table the screen builds out of a
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
//
// **2026-09-21, issue #956 — a wrap is one of two right answers, not the
// only one.** A scroller keeps a wide row *reachable*; it does not keep it
// *read*. On the free report's absent-from table the column pushed off the
// right edge at 390 was "Holds #1" — the one that names the rival — on the
// first screen a prospect sees, most often on a phone. So that table now
// falls to a stacked shape below `sm` and scrolls only from `sm` up.
//
// The rule these rows keep is therefore the *disjunction*: a table or grid
// on the report is inside a wrap that can scroll, **or** it stacks below
// `sm` so that there is nothing to scroll. What is no longer allowed is
// neither — which is the defect #244 found and the one this file has always
// been for. `STACKS` below is the second arm, spelled as the two things
// that shape actually needs, so a module cannot claim it by writing the
// word `sm:` anywhere.
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

/** The other right answer (#956): the wrap scrolls only from `sm`, and the
 *  head row is hidden below it because each value carries its own label
 *  there instead. Both halves are required — a `sm:overflow-x-auto` with a
 *  head row still showing is a three-column table on a phone with no way to
 *  reach its third column, which is worse than the scroller it replaced. */
const STACKS = /sm:overflow-x-auto/;
const STACKED_HEAD = /hidden sm:table-header-group/;

/** A module answers §2.2 if it scrolls, or if it stacks. */
const wrapped = (source: string): boolean =>
  WRAP.test(source) || (STACKS.test(source) && STACKED_HEAD.test(source));

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

describe("a table or grid on the report scrolls inside its own wrap, or stacks so it need not", () => {
  it("every table a module writes is inside the wrap", () => {
    for (const name of files) {
      const source = read(name);
      if (!/<table[\s>]/.test(source)) continue;
      expect(wrapped(source), name).toBe(true);
      const at = WRAP.test(source) ? source.search(WRAP) : source.search(STACKS);
      expect(at, name).toBeGreaterThan(-1);
      expect(at, name).toBeLessThan(source.search(/<table[\s>]/));
    }
  });

  it("the modules directory is actually read — a rule over nothing is not a rule", () => {
    expect(files.length).toBeGreaterThan(2);
  });

  it("every hand-built multi-column grid sits inside the wrap, or is a named gap", () => {
    const unwrapped: string[] = [];
    for (const name of files) {
      const source = read(name);
      const multi = trackLists(source).filter((tracks) => tracks.length > 1);
      if (multi.length === 0) continue;
      if (wrapped(source)) continue;
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
      expect(wrapped(source), `${entry.file} is wrapped now — drop its entry`).toBe(false);
      expect(entry.issue).toMatch(/^#\d+$/);
    }
  });

  it("the module grids stretch the two-up cards to one height (the calm layer, #1068)", () => {
    // `docs/DESIGN.md`, 2026-09-24: "Cards in a row stretch to one height."
    // This was `items-start` (#244), because daisyUI's `.card-body p
    // { flex-grow: 1 }` handed a stretched card's slack to its paragraphs;
    // the two cards' own paragraphs are `grow-0` now, so the rows stretch.
    const view = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(public)/scan/[domain]/_address/report-view.tsx"),
      "utf8"
    );
    const grids = [...view.matchAll(/className="[^"]*grid[^"]*(?:subgrid|grid-cols-2)[^"]*"/g)].map(
      (m) => m[0]
    );
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) expect(grid, grid).not.toContain("items-start");
  });

  it("the presence card's occupancy is the registered drawing, and needs no scroll container", () => {
    // The hand-built occupancy row is gone (issue #352): the domains, the
    // bars and the counts are `PresenceBars`, §2.4's own drawing of this
    // card's figure.
    //
    // **It used to be checked for a wrap, and that row is now the opposite
    // claim (#956).** The wrap was there for the drawing #943 replaced,
    // whose labels were laid out beside the bars and could run wider than
    // the card. Since #943 each row is a line of HTML above a bar that is
    // `width: 100%`, with the domain clamped to its own line — so nothing
    // in the drawing can be wider than the box, and an `overflow-x: auto`
    // that never scrolls is still a box the layout law must excuse and a
    // tab stop #947 would have to name.
    const source = read("google-presence.tsx");
    expect(source).toContain("<PresenceBars");
    expect(WRAP.test(source), "the unconditional wrap is gone from this module").toBe(false);
    expect(wrapped(source), "the table below it still answers §2.2, by stacking").toBe(true);
  });

  it("the absent-from table stacks below sm and scrolls only from sm up (#956)", () => {
    // The shape the issue asks for, asserted as the four things that make
    // it one rather than as a screenshot: the wrap scrolls only from `sm`,
    // the head row is hidden below it, each value carries the column head
    // that would have named it, and the cells are subgrid.
    const source = read("google-presence.tsx");
    expect(STACKS.test(source)).toBe(true);
    expect(STACKED_HEAD.test(source)).toBe(true);
    expect(source).toContain("grid-cols-subgrid");
    // `display: contents` generates no box, so every value inside one
    // measures as escaping its parent — #952 found that with forty-eight
    // containment offenders. Subgrid is the shape that does not. Read off
    // the class lists rather than the file, or the paragraph in the module
    // that explains this very choice would fail it.
    const classLists = [...source.matchAll(/className="([^"]*)"/g)].map((m) => m[1] ?? "");
    const usesContents = classLists.some((list) =>
      list.split(/\s+/).some((token) => token === "contents" || token.endsWith(":contents"))
    );
    expect(usesContents, "a cell is `display: contents` — use grid-cols-subgrid").toBe(false);
    // No new sentence: the stacked labels are the `<th>`s' own keys.
    for (const key of ["presence.absent-from.column.volume", "presence.absent-from.column.holder"]) {
      expect(source.split(key).length - 1, key).toBeGreaterThanOrEqual(2);
    }
  });
});
