// `src/ui/theme.css` carries exactly `design/tokens.md`'s set (issue #349).
// tests/ui/design/token-set.test.ts
//
// The owner's goal is token fidelity, and until this test there was nothing
// comparing the two: the document named sixty-six tokens for the product,
// `theme.css` declared twenty-eight, and the other thirty-eight were either
// declared in four other stylesheets or spent as bare literals. A value with
// two homes drifts; a value with no name cannot be checked at all.
//
// The comparison runs in both directions and names what is missing on each
// side, because either direction is a real defect: a token in the file and
// not the document is a value nobody approved, and a token in the document
// and not the file is a rule nothing enforces.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allDocumentTokens, approvedTokens, NAMED_BUT_NOT_APPROVED } from "./tokens-doc";

const THEME_CSS = path.resolve(import.meta.dirname, "../../../src/ui/theme.css");

/** Every custom property `theme.css` declares, in any of its three blocks.
 *  A token declared only in a dark block is still declared. */
function declaredTokens(): ReadonlySet<string> {
  const source = readFileSync(THEME_CSS, "utf8");
  return new Set([...source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]!));
}

describe("issue #349 — theme.css and tokens.md name the same set", () => {
  const declared = declaredTokens();
  const approved = approvedTokens();

  it("every token the document approves is declared", () => {
    const missing = [...approved].filter((token) => !declared.has(token)).sort();
    expect(missing, `named in tokens.md and declared nowhere: ${missing.join(" ")}`).toEqual([]);
  });

  it("every token declared is one the document approves", () => {
    const extra = [...declared].filter((token) => !approved.has(token)).sort();
    expect(extra, `declared in theme.css and named nowhere in tokens.md: ${extra.join(" ")}`).toEqual(
      []
    );
  });

  it("the set is the size the audit measured, and the difference is stated", () => {
    // Rule 5.5: the number is reported rather than left to be read off a
    // green run. The master's audit counted the whole document; this set is
    // the issue's own scope — §1, §2, §2b, §3, §4 and §9 — and the two
    // excluded names below are the difference, each with the document's
    // reason.
    expect(approved.size).toBe(64);
    expect(Object.keys(NAMED_BUT_NOT_APPROVED).sort()).toEqual(["--glass-fill", "--glass-line"]);
  });

  it("the sections outside that scope name tokens the product must not declare", () => {
    // §5's `--grid-week`, §7's `--r-edge` and §8's three `--v-*` are named
    // in the document and are **not** approved values: a chart constraint,
    // a fourth radius `BUILD.md` §2.1's "these exact values" does not
    // admit, and three positions in the variant layer the owner rejected.
    // Asserted so that widening the scope later is a decision rather than
    // an accident.
    const outside = [...allDocumentTokens()].filter((token) => !approvedTokens().has(token));
    expect(outside.sort()).toEqual([
      "--glass-fill",
      "--glass-line",
      "--grid-week",
      "--r-edge",
      "--v-card-pad",
      "--v-eyebrow-track",
      "--v-r-card",
    ]);
    for (const token of outside) expect(declaredTokens().has(token)).toBe(false);
  });
});
