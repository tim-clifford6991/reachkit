// Each allow line is `string<TAB>reason`, cites a ruling, a decision file or an issue, and names a board string.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPONENT_LINE, compareComponents } from "../../../scripts/design/components.mjs";
import {
  BOARDS_DIR,
  boardFile,
  boardStrings,
  CITATION,
  COMPONENT,
  compare,
  PARITY_DIR,
  parseAllow,
  readAllow,
  segments,
  sha256,
  verdict,
  words,
} from "../../../scripts/design/parity.mjs";

function problems(board: string, text: string, strings: string[]): string[] {
  const known = new Set(strings.map((s) => words(s).join(" ")));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { n, string, reason, extra } of parseAllow(text)) {
    const key = words(string).join(" ");
    if (extra > 0 || reason === "") out.push(`${board}.allow:${n} is not string<TAB>reason`);
    else if (!CITATION.test(reason)) out.push(`${board}.allow:${n} cites no ruling, decision file or issue: ${reason}`);
    else if (/\bpending\b/i.test(reason)) out.push(`${board}.allow:${n} cites a ruling still pending: ${reason}`);
    if (key === "theme light" && !reason.startsWith("DESIGN.md")) out.push(`${board}.allow:${n} cites no DESIGN.md › Theme for the theme control: ${reason}`);
    if (string.startsWith(COMPONENT)) {
      if (!COMPONENT_LINE.test(string)) out.push(`${board}.allow:${n} is not component:<token> <n>: ${string}`);
      // A missing component is a build gap, never sample content, so it needs a ruling or an issue.
      if (/\bsample data\b/i.test(reason)) out.push(`${board}.allow:${n} cites sample data for a component: ${reason}`);
    } else if (!known.has(key)) out.push(`${board}.allow:${n} is no string on the board: ${string}`);
    if (seen.has(key)) out.push(`${board}.allow:${n} repeats: ${string}`);
    seen.add(key);
  }
  return out;
}

const files = readdirSync(PARITY_DIR).filter((f) => f.endsWith(".allow"));
const boards = readdirSync(BOARDS_DIR).filter((f) => f.endsWith(".dc.html")).map((f) => f.slice(0, -".dc.html".length));

describe("docs/design/parity/*.allow", () => {
  it("fails a line with no citation, no tab, or a string the board does not draw", () => {
    const strings = ["Harbor Plumbing", "14-day money-back guarantee"];
    expect(problems("Board", "Harbor Plumbing\tsample data\n14-day money-back guarantee\towner 2026-10-20 Q13\n", strings)).toEqual([]);
    expect(problems("Board", "Harbor Plumbing\tthe designer said so\n", strings).join()).toContain("cites no ruling");
    expect(problems("Board", "Harbor Plumbing sample data\n", strings).join()).toContain("is not string<TAB>reason");
    expect(problems("Board", "Austin Plumbing\tsample data\n", strings).join()).toContain("no string on the board");
  });

  it("fails a line that waits on a ruling, and a Theme line that cites anything but DESIGN.md", () => {
    const strings = ["Theme: light", "Harbor Plumbing"];
    expect(problems("Board", "Harbor Plumbing\towner ruling pending on #1746\n", strings).join()).toContain("still pending");
    expect(problems("Board", "Theme: light\t#1744: the app shell's theme control\n", strings).join()).toContain("DESIGN.md");
    expect(problems("Board", "Theme: light\tDESIGN.md: the theme control is the dropdown named Theme (#681)\n", strings)).toEqual([]);
  });

  it("a row with an unused allow line fails, naming the file, the line and the string; a used line passes", () => {
    const fixtures = path.join(__dirname, "fixtures");
    const board = boardFile("Board", fixtures);
    const html = readFileSync(board, "utf8");
    const page = segments(readFileSync(path.join(fixtures, "page.html"), "utf8"));
    const allow = readAllow("Board", fixtures);
    const result = compare(html, page, allow);
    expect(result.unused.map((u) => u.n)).toEqual([1, 2]);
    expect([result.matched.length, result.missing.length, result.allowed.length]).toEqual([9, 5, 1]);
    const failed = verdict("Board", result.missing, { sha256: sha256(board), missing: 5 }, sha256(board), result.unused);
    expect(failed.ok).toBe(false);
    expect(failed.message).toContain("docs/design/parity/Board.allow:1 Pricing (delete it: the string ships)");
    const used = compare(html, page, allow.slice(2));
    expect(used.unused).toEqual([]);
    expect(verdict("Board", used.missing, { sha256: sha256(board), missing: 5 }, sha256(board), used.unused).ok).toBe(true);
  });

  it("a component line excuses up to n of its gap, and fails when it ships, is not drawn, or excuses more than the gap", () => {
    const ring = '<svg viewBox="0 0 100 100"><circle r="40" fill="none"></circle></svg>';
    const board = `<main><p>Board</p>${ring}${ring}<div class="card"></div></main>`;
    const page = '<main><p>Board</p><div class="card"></div></main>';
    const line = (string: string, n: number) => ({ string, n, reason: "#1992" });
    const used = compareComponents(board, [page], [line("component:ring 2", 1)]);
    expect([used.missing, used.allowed, used.unused]).toEqual([[], ["ring", "ring"], []]);
    const unused = compareComponents(board, [page], [line("component:ring 3", 1), line("component:card 1", 2), line("component:chart 1", 3)]);
    const failed = verdict("Board", unused.missing, { sha256: "x", missing: 0, components: 0 }, "x", unused.unused, "components");
    expect(failed.ok).toBe(false);
    expect(failed.message).toContain("Board.allow:1 component:ring 3 (lower it to 2)");
    expect(failed.message).toContain("Board.allow:2 component:card 1 (delete it: the component ships)");
    expect(failed.message).toContain("Board.allow:3 component:chart 1 (delete it: the board does not draw it)");
    expect(compare(board, ["Board"], [line("component:ring 2", 1)]).unused).toEqual([]);
    expect(problems("Board", "component:ring two\t#1992\n", ["Board"]).join()).toContain("not component:<token> <n>");
    expect(problems("Board", "component:ring 1\tsample data\n", ["Board"]).join()).toContain("cites sample data for a component");
    expect(problems("Board", "component:ring 1\t#1992\n", ["Board"])).toEqual([]);
  });

  it("a component line below the gap excuses n and leaves the rest missing", () => {
    const ring = '<svg viewBox="0 0 100 100"><circle r="40" fill="none"></circle></svg>';
    const parts = compareComponents(`<main>${ring}${ring}</main>`, ["<main></main>"], [{ string: "component:ring 1", n: 1 }]);
    expect([parts.missing, parts.allowed, parts.unused]).toEqual([["ring"], ["ring"], []]);
  });

  it("a page or hosted row with no components count fails, and names the line to commit", () => {
    const result = verdict("Board", [], { sha256: "x", missing: 0 }, "x", [], "components");
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Board has no "components" in docs/design/parity/baseline.json');
    expect(result.message).toContain('"Board": { "sha256": "x", "missing": 0, "components": 0 }');
  });

  it("reads a board string that starts with # as a line, and a # line with no tab as a comment", () => {
    expect(parseAllow("# a note\n## Stop the water\tsample data\n").map((line: { string: string }) => line.string)).toEqual(["## Stop the water"]);
  });

  it.each(files)("%s names a board and every line cites its reason", (file) => {
    const board = file.slice(0, -".allow".length);
    expect(boards, `${file} names no canvas board`).toContain(board);
    const strings = boardStrings(readFileSync(boardFile(board), "utf8"));
    expect(problems(board, readFileSync(path.join(PARITY_DIR, file), "utf8"), strings)).toEqual([]);
  });
});
