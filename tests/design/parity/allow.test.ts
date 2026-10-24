// Each allow line is `string<TAB>reason`, cites a ruling, a decision file or an issue, and names a board string.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BOARDS_DIR, boardFile, boardStrings, CITATION, PARITY_DIR, parseAllow, words } from "../../../scripts/design/parity.mjs";

function problems(board: string, text: string, strings: string[]): string[] {
  const known = new Set(strings.map((s) => words(s).join(" ")));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { n, string, reason, extra } of parseAllow(text)) {
    const key = words(string).join(" ");
    if (extra > 0 || reason === "") out.push(`${board}.allow:${n} is not string<TAB>reason`);
    else if (!CITATION.test(reason)) out.push(`${board}.allow:${n} cites no ruling, decision file or issue: ${reason}`);
    if (!known.has(key)) out.push(`${board}.allow:${n} is no string on the board: ${string}`);
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
