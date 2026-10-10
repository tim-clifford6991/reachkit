// SPEC §2 2026-10-10 (owner, issue 1377) — a placeholder is not an answer.
// src/lib/measure/placeholder.ts
//
// Asked for a category it could not read, the market inference answered
// with the literal `<UNKNOWN>` (gusto.com, 2026-10-08). It was stored as
// the category and `/scans` listed it as one. Every place a model's word
// becomes a stored category asks this first, and every reader of a stored
// one asks it again, so a row written before this line is read the same
// way. It under-reports: only what names nothing is a placeholder. Pure.

/** The words that say "there is none", as letters and digits only —
 *  "N/A" and "n.a." both read `na`. */
const NO_ANSWER: ReadonlySet<string> = new Set([
  "",
  "unknown",
  "na",
  "none",
  "null",
  "undefined",
  "notapplicable",
]);

/** Whether a model's answer is a stand-in for no answer: empty, a word that
 *  says there is none, or anything wholly in angle brackets. */
export function isPlaceholder(text: string): boolean {
  const said = text.trim();
  if (/^<.*>$/su.test(said)) return true;
  return NO_ANSWER.has(said.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
}
