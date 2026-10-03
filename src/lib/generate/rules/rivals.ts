// BUILD §8 hard rule 6 — no invented rival metrics.
//
// "No rival metrics invented; every rival claim links its public source."
// A statement that names a rival and carries a numeral must carry a link in
// **the same sentence** — and, since the two pools (SPEC §7, 2026-09-29;
// issue 1135), that link is to a page one of the page's facts was read from.
// The research step supplies those pages; an address the model reached for
// on its own sources nothing.
//
// Sentence rather than paragraph, deliberately: a paragraph-wide scope lets
// one sourced figure legitimise three unsourced ones standing beside it,
// which is the failure the rule exists to prevent.
//
// The figure the failure carries is the numeral as it appears in the draft
// — a stored value read straight out of the text, never a sentence and
// never anything a model wrote.
import { urlKey } from "../links/select";
import { sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** A numeral a reader would meet as a figure: digits, optionally with
 *  grouping separators, a decimal part, a percent sign or a currency
 *  symbol. A bare year is still a figure — "raised $4M in 2019" states two
 *  things about a rival and both want a source. */
const FIGURE_RE = /[$€£]?\d[\d,.]*\s*%?/g;

/** A rival is named by its domain or by its name. Both are stored values on
 *  the site; nothing here recognises a company it was not given. */
function namesRival(sentence: string, rivals: readonly string[]): boolean {
  const haystack = sentence.toLowerCase();
  return rivals.some((rival) => {
    const token = rival.trim().toLowerCase();
    if (token.length === 0) return false;
    if (haystack.includes(token)) return true;
    // A rival recorded as a domain is also named by its registrable label.
    const label = token.split(".")[0] ?? "";
    return label.length > 2 && haystack.includes(label);
  });
}

function firstFigure(sentence: string): string | null {
  FIGURE_RE.lastIndex = 0;
  const match = FIGURE_RE.exec(sentence);
  return match === null ? null : match[0].trim();
}

/** The figure a sentence states about a rival with no fact's page beside
 *  it, or `null`. `pages` is the fact pages' keys; `null` is a page written
 *  before the research step, where any link sources it. */
export function unsourcedRivalFigure(
  sentence: { text: string; hasLink: boolean; links?: readonly string[] },
  rivals: readonly string[],
  pages: ReadonlySet<string | null> | null
): string | null {
  const cited = pages === null ? sentence.hasLink : (sentence.links ?? []).some((link) => pages.has(urlKey(link)));
  if (cited || !namesRival(sentence.text, rivals)) return null;
  return firstFigure(sentence.text);
}

/** The fact pages, as the rule compares them. */
export function factPageKeys(factPages: readonly string[] | undefined): ReadonlySet<string | null> | null {
  return factPages === undefined ? null : new Set(factPages.map(urlKey));
}

export function checkRivalSource(a: {
  markdown: string;
  rivals: string[];
  /** The pages the page's facts were read from, either pool. Absent on a
   *  page written before the research step: any link sources it, as then. */
  factPages?: readonly string[];
}): RuleFailure | null {
  if (a.rivals.length === 0) return null;
  const pages = factPageKeys(a.factPages);
  for (const sentence of sentencesOf(a.markdown)) {
    const figure = unsourcedRivalFigure(sentence, a.rivals, pages);
    if (figure === null) continue;
    return { rule: "rival_source", detail: { rule: "rival_source", figure } };
  }
  return null;
}
