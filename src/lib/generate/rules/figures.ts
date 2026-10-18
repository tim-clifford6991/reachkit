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

// Issue 1507 (D66): a figure read the way its page's language writes it.
// "$1,597", "1597" and "1.597 €" are one number; so are "5" and "five".
// The separators are `Intl`'s for the language, and a figure whose
// separators each stand before three digits is also read with them as
// grouping — a page in one language quoting a price in another's format.
const FIGURE_RE = /(?<![\p{L}\d.,])\d+(?:[.,\u00a0\u202f]\d+)*/gu;

function separatorsOf(language: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(language).formatToParts(12345.6);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

const valueKey = (value: number): string => String(Math.round(value * 100) / 100);

/** Every value one written figure may be read as, in that language. */
function readingsOf(raw: string, language: string): string[] {
  const { group, decimal } = separatorsOf(language);
  // A thin or no-break space groups digits in every language.
  const local = Number(raw.replace(/[\u00a0\u202f]/g, "").split(group).join("").replace(decimal, "."));
  const grouped = /^\d{1,3}(?:[.,\u00a0\u202f]\d{3})+$/.test(raw) ? Number(raw.replace(/[^\d]/g, "")) : null;
  return [...new Set([local, grouped].filter((value): value is number => value !== null && Number.isFinite(value)).map(valueKey))];
}

/** The figures a text states, each as written and with every value it may
 *  be read as. */
export function figuresOf(text: string, language: string = "en"): Array<{ raw: string; at: number; values: string[] }> {
  return [...text.matchAll(FIGURE_RE)].map((match) => ({ raw: match[0].trim(), at: match.index, values: readingsOf(match[0].trim(), language) }));
}

/** Every value a text states: its figures, and its numbers written as
 *  words in the language's own (`numberWords`). */
export function valuesStated(text: string, language: string, numberWords: readonly string[]): Set<string> {
  const out = new Set(figuresOf(text, language).flatMap((figure) => figure.values));
  const words = new Map(numberWords.map((word, value) => [word, String(value)]));
  for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    const value = words.get(word);
    if (value !== undefined) out.add(value);
  }
  return out;
}
