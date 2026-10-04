// SPEC §7 (D41 stage 4; issue 1250) — no placeholder cell.
//
// "A table never ships with an empty or 'not stated' cell" (owner,
// 2026-10-02, round 1). The page pass takes such a cell's row or column out
// before the checks read the page (`../pipeline/sources.ts`); this is the
// check that a cell did not survive it — and what an edit is held to. The
// test of a cell is this file's `isPlaceholderCell`, which the pass uses, so what is taken
// out and what is stopped cannot part.
import { renderOf } from "./text";
import type { RuleFailure } from "./types";

/** What a writer says of a value it was not handed: that no fact states,
 *  lists, links or carries it. Round 2 (issue 1250) met the owner's round-1
 *  "not stated" again as "not linked to a stated figure" and "not carried by
 *  a linked market fact here", so the words are held as a family, with or
 *  without one word between ("not publicly listed"). */
const MISSING =
  "stated|listed|specified|disclosed|available|published|mentioned|provided|given|linked|carried|found|known|shown|sourced|cited|confirmed|verified|reported|documented|public|clear";
const MISSING_NOUN = "figures?|prices?|pricing|costs?|rates?|numbers?|data|information|details?|sources?|facts?";

/** What a writer puts in a cell it has nothing for. */
const EMPTY_CELL_RE = new RegExp(
  [
    String.raw`^(?:|[-–—?]+|none stated|tbd|tbc|varies(?: by plan)?)\.?$`,
    String.raw`\b(?:n\/a|unknown|unclear|un(?:stated|disclosed|specified|published|listed|verified|confirmed))\b`,
    String.raw`^na\.?$`,
    String.raw`\bnot (?:\w+ )?(?:${MISSING})\b`,
    String.raw`\bno (?:${MISSING}) (?:${MISSING_NOUN})\b`,
    String.raw`\bno (?:${MISSING_NOUN}) (?:(?:is|are|was|were) )?(?:${MISSING})\b`,
  ].join("|"),
  "i"
);

/** Whether a table cell's words, as a reader meets them, say nothing: a
 *  blank, a dash, or a phrase that stands in for a value nobody read. The
 *  grader counts with this same test (`scripts/eval-content/grade.ts`), so
 *  what the page pass takes out and what the count calls empty cannot part. */
export function isPlaceholderCell(rendered: string): boolean {
  return EMPTY_CELL_RE.test(rendered.trim());
}

const ROW_RE = /^[ \t]*\|.*\|[ \t]*$/;
const DELIMITER_RE = /^[ \t]*\|(?:[ \t]*:?-{1,}:?[ \t]*\|)+[ \t]*$/;

export function checkPlaceholderCell(a: { markdown: string }): RuleFailure | null {
  const lines = a.markdown.split("\n");
  for (let at = 0; at < lines.length; at++) {
    if (!ROW_RE.test(lines[at]!) || !DELIMITER_RE.test(lines[at + 1] ?? "")) continue;
    for (let row = at + 2; row < lines.length && ROW_RE.test(lines[row]!); row++) {
      const cells = lines[row]!.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/);
      // The first cell names the row.
      for (const cell of cells.slice(1)) {
        const words = renderOf(cell).trim();
        if (isPlaceholderCell(words)) return { rule: "no_placeholder_cell", detail: { rule: "no_placeholder_cell", cell: words } };
      }
      at = row;
    }
  }
  return null;
}
