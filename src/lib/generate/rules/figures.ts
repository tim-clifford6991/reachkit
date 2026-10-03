// SPEC §7 — the numerals a sentence states, and the floor below which a
// numeral is not a figure.
//
// **There is no private-figure register any more** (issue 1187). The rule
// that owned this file built the set of every number in the stored report and
// failed a page where a numeral matched one. Measured on every stored draft
// and evaluation draft it fired on 14 of 22 pages and was wrong on all 14:
// the report holds 10, 12, 20, 24, 30 and 40 among its counts, so "24-hour",
// "12 questions" and "40% more" were each read as a measurement leaked. A
// number the product measured and no source states is a number no fact
// holds, and `traceable_numerals` (`./brief.ts`) stops that one by what it
// is, not by coincidence. `docs/walk/rule-review.md` has the table.

/** A figure below this is not one a reader would look for a source for:
 *  single digits are ordinals, list counts and prices, and holding them to a
 *  source would fail every draft that says "three steps". */
export const REGISTER_FLOOR = 10;

/** The numerals a sentence states, normalised: grouping separators dropped,
 *  a decimal part rounded. */
// Digits glued to a letter before them are part of a name — "GA4", "ISO27001",
// a printed reference label "F101" — and not a figure (issue 1187).
const NUMERAL_RE = /(?<![\p{L}\d.,])\d[\d,]*(?:\.\d+)?/gu;

export function numeralsOf(sentence: string): Array<{ raw: string; normalised: string }> {
  NUMERAL_RE.lastIndex = 0;
  const out: Array<{ raw: string; normalised: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = NUMERAL_RE.exec(sentence)) !== null) {
    const raw = match[0];
    const parsed = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) continue;
    out.push({ raw, normalised: String(Math.round(parsed)) });
  }
  return out;
}
