// The approved token set, read from `design/tokens.md` (issue #349).
// tests/ui/design/tokens-doc.ts
//
// One reader, two tests: `token-set.test.ts` holds `src/ui/theme.css` equal
// to this set, and `tests/ui/tokens.test.ts` uses it to say which tokens
// beyond `BUILD.md` §2.1's colour block are allowed to exist. A second copy
// of "what the document names" is exactly the drift this issue is about.
//
// **Section-scoped, and the scope is the issue's own** — §1, §2, §2b, §3
// and §4, plus §9. That is not the whole document, and the difference
// matters: §5 through §8 name tokens that are *proposals or rejections*,
// and declaring one would put a value in the product the owner never
// approved. The five are listed in `NAMED_BUT_NOT_APPROVED` below with the
// section and the reason, so the exclusion is reviewable rather than a
// silent shortfall against a whole-document count.
import { readFileSync } from "node:fs";
import path from "node:path";

const TOKENS_MD = path.resolve(
  import.meta.dirname,
  "../../../archive/sdlc-factory-2026-09-04/corpus/docs/design/tokens.md"
);

/** The sections whose tokens the product declares. Matched on the heading
 *  line so a renumbered document fails loudly rather than silently
 *  narrowing the set. */
const APPROVED_SECTIONS: readonly string[] = [
  "## 1. Colour",
  "## 2. Radius, shadow, ring, spacing",
  "## 2b. Derived under rule 1.1 — the edge-and-size contract",
  "## 3. daisyUI 5 slot mapping",
  "## 4. Type and numerals",
  "## 9. The approved card idiom — 2026-09-02",
];

/**
 * Tokens the document names inside those sections that `theme.css` still
 * must not declare, each with the document's own reason. Any other name in
 * an approved section is expected in the file.
 */
export const NAMED_BUT_NOT_APPROVED: Readonly<Record<string, string>> = Object.freeze({
  "--glass-fill": [
    "§9.3 states plainly that this is **not a token**: 'no token is added:",
    "the two are named `--glass-fill` and `--glass-line` inside the idiom's",
    "own scope, where the names are the system's and the values are",
    "BUILD.md's'. They are the 12%/28% alphas §2.1 states, applied to",
    "`--on-accent`, and `src/ui/idiom/idiom.css` spends them inline in the",
    "one rule that needs them.",
  ].join(" "),
  "--glass-line": "§9.3, with `--glass-fill` — see that entry.",
});

/** Every `--name` the document backticks inside a section. */
function tokensInSection(source: string, heading: string): Set<string> {
  const start = source.indexOf(heading);
  if (start === -1) throw new Error(`tokens.md: no section "${heading}" — has it been renumbered?`);
  const after = source.indexOf("\n## ", start + heading.length);
  const body = source.slice(start, after === -1 ? undefined : after);
  return new Set([...body.matchAll(/`(--[a-z0-9-]+)`/g)].map((m) => m[1]!));
}

/** The set `src/ui/theme.css` is expected to declare, exactly. */
export function approvedTokens(): ReadonlySet<string> {
  const source = readFileSync(TOKENS_MD, "utf8");
  const out = new Set<string>();
  for (const heading of APPROVED_SECTIONS) {
    for (const token of tokensInSection(source, heading)) out.add(token);
  }
  for (const excluded of Object.keys(NAMED_BUT_NOT_APPROVED)) out.delete(excluded);
  return out;
}

/** Every `--name` the document backticks anywhere — the whole-document
 *  count the master's audit reported. Used only to state the difference. */
export function allDocumentTokens(): ReadonlySet<string> {
  const source = readFileSync(TOKENS_MD, "utf8");
  return new Set([...source.matchAll(/`(--[a-z0-9-]+)`/g)].map((m) => m[1]!));
}
