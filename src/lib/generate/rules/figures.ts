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

// SPEC §7 (owner, 2026-10-17, issue 1490): the site's own measurements are
// stated only on a research page. A measurement is a pair — "4 of the 12",
// "18 out of 100", "18/100", "4 von 12" — or a score ("a Visibility Score of
// 18"), and it is matched as that shape, never as a bare number: a register
// of every number the report holds read "24-hour" as a leak (issue 1187).
const PAIR_RE = /(?<![\p{L}\d.,])(\d[\d,]*)\s*(?:\/|out of|of(?: the)?|von(?: den)?)\s*(\d[\d,]*)(?![\d])/giu;
const SCORE_RE = /\bscore\p{L}*\s+(?:of\s+|von\s+)?(\d+)(?![\d])/giu;

const whole = (raw: string): string => String(Number(raw.replace(/,/g, "")));

/** The measurements a text states, each as `count/total`. A score is out of
 *  100. */
export function measurementsIn(text: string): Array<{ raw: string; key: string }> {
  const out: Array<{ raw: string; key: string }> = [];
  for (const match of text.matchAll(PAIR_RE)) out.push({ raw: match[0], key: `${whole(match[1]!)}/${whole(match[2]!)}` });
  for (const match of text.matchAll(SCORE_RE)) out.push({ raw: match[0], key: `${whole(match[1]!)}/100` });
  return out;
}

/** The first of `own` — measurements read off the site's report — that a
 *  sentence states, or `null`. */
export function ownMeasurementIn(sentence: string, own: ReadonlySet<string>): string | null {
  if (own.size === 0) return null;
  return measurementsIn(sentence).find((each) => own.has(each.key))?.raw ?? null;
}
