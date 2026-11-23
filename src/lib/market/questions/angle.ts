// SPEC §6 *Every topic is an angle* (owner rulings 91–92, #2722): the one place a found search becomes a page's angle.
// The model proposes two or three angles per search in one of five patterns; code keeps the one that passes every gate
// and promises most of what the top results miss. The weekly topic step and the hot-topic lane both call `pickAngle`.
import { LANGUAGE_PACKS, SHAPES } from "@/lib/locale/language";
import { contentTokens } from "@/lib/market/questions/select";

export const ANGLE_PATTERNS = ["P1", "P2", "P3", "P4", "P5"] as const;
export type AnglePattern = (typeof ANGLE_PATTERNS)[number];

/** How an angle is asked, word for word, by the fit call and by the commit's title call. */
export const ANGLE_ASK = {
  pages: "two different pages that would answer it for this buyer. Each joins the search to a passage in `product.knowledge` (`fact`) and uses one `pattern`: P1 a problem and how this business's method fixes it; P2 the question answered from the business's own facts; P3 a comparison where the business is a real option; P4 how to do the job with a new thing the search or `ranks` names; P5 the search for a place or segment the business serves.",
  title: "Each angle's `title` is at most 65 characters in Title Case, starts with the search's own words or its main noun phrase, and states what the reader gets, which none of the search's `ranks` already promises. `promise` says that in at most eight words. A title names a product, model, version, number, price or date only when it is written in the search, `product.knowledge` or `ranks`. A bare search with a number or a price appended is not an angle, and a price leads only a pricing or comparison search. A comparison title never says what a named competitor does, lacks or who uses it; it names the decision the page helps the reader make.",
} as const;

/** What the model proposes: a pattern, a title, what the reader gets, and the knowledge passage it joins the search to. */
export interface ProposedAngle {
  pattern: AnglePattern;
  title: string;
  promise: string;
  fact: number | null;
}

/** The angle a topic keeps, stored on its evidence beside `fitFact`, the passage that says why it fits the business. */
export interface TopicAngle {
  pattern: AnglePattern;
  promise: string;
  /** How many of the top results' titles carry its promise words; fewer is the gap the page fills. */
  gap: number;
}

/** What the gates read: the search, the passages and research it may name things from, and the top results' titles. */
export interface AngleContext {
  search: string;
  /** Every text a named thing may come from: the knowledge passages, the stored research, the market's own names. */
  sources: readonly string[];
  /** The first five titles of the search's stored top ten. */
  ranks: readonly string[];
  /** How many knowledge passages were shown; an angle's `fact` must be one of them. Absent, any passage or none is shown. */
  passages?: number;
  /** The rivals' names and domains: a comparison's title names none beyond the search's own. */
  rivals?: readonly string[];
}

const HEAD_CHARS = 30;
const LEAD_WORDS = 3;

const lowered = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The pattern fits the search's intent: a comparison only on a list, a versus or an alternatives search; a method on a problem or a how-to. */
function patternAllowed(pattern: AnglePattern, search: string): boolean {
  const text = lowered(search);
  if (pattern === "P3") return SHAPES.listicle.test(text) || SHAPES.solution.test(text) || SHAPES.comparison.test(text);
  if (pattern === "P1") return SHAPES.problem.test(text) || SHAPES.howTo.test(text) || SHAPES.pain.test(text) || /^why\b/.test(text);
  return true;
}

/** The search's first subject words are all in the title, and the first starts inside its head: the phrasing people search. */
export function leadsWithSearch(title: string, search: string): boolean {
  const subject = contentTokens(search).slice(0, LEAD_WORDS);
  if (subject.length === 0) return true;
  const words = [...title.toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({ word: contentTokens(match[0])[0] ?? "", at: match.index }));
  return subject.every((token) => words.some((each) => each.word === token)) && words.some((each) => each.word === subject[0] && each.at < HEAD_CHARS);
}

/** The figures and named things a title states: a token with a digit, or with a capital past its first letter ("ChatGPT", "SEO"). */
function namedThings(title: string): string[] {
  return [...title.matchAll(/[$€£¥]?[\p{L}\p{N}][\p{L}\p{N}.,%-]*/gu)]
    .map(([token]) => token.replace(/[.,-]+$/u, ""))
    .filter((token) => /\d/.test(token) || /^.\p{Ll}*\p{Lu}/u.test(token));
}

/** Every named thing is written in the search or a source: never the model's memory. */
export function namesAreReal(title: string, a: AngleContext): boolean {
  const held = [a.search, ...a.sources, ...a.ranks].join("\n").toLowerCase();
  return namedThings(title).every((token) => held.includes(token.toLowerCase().replace(/^[$€£¥]/u, "")));
}

/** A price leads only a price or comparison page: anywhere else the business's price or a rival's plan is no promise. */
export function priceLed(title: string, search: string): boolean {
  const text = lowered(search);
  return /[$€£¥]\s?\d|\d\s?[$€£¥]/u.test(title) && !SHAPES.price.test(text) && !SHAPES.comparison.test(text);
}

/** A comparison that names a rival the search does not makes a claim about that rival nothing here supports. */
function namesOtherRival(angle: ProposedAngle, a: AngleContext): boolean {
  if (angle.pattern !== "P3") return false;
  const [title, searched] = [` ${lowered(angle.title)} `, ` ${lowered(a.search)} `];
  return (a.rivals ?? []).map(lowered).some((rival) => rival !== "" && !searched.includes(` ${rival} `) && title.includes(` ${rival} `));
}

/** On a list or comparison search, a clause joined on after the title's break ("— and the tool that…") is a claim about
 *  the business, not the decision the page helps the reader make. */
export function appendsClaim(title: string, search: string): boolean {
  const lead = /[:?—–]|\s-\s/u.exec(title);
  return lead !== null && SHAPES.listicle.test(lowered(search)) && SHAPES.appended.test(lowered(title.slice(lead.index + lead[0].length)));
}

const HYPE = LANGUAGE_PACKS.flatMap((pack) => pack.title.banned);

/** A banned or hype phrase the searcher did not use themselves. */
const hyped = (title: string, search: string): boolean => HYPE.some((phrase) => title.toLowerCase().includes(phrase) && !search.toLowerCase().includes(phrase));

/** A title whose every content word is the search's is the search restated, with no promise. */
function restates(title: string, search: string): boolean {
  const searched = new Set(contentTokens(search));
  return contentTokens(title).every((word) => searched.has(word));
}

/** How many of the top results' titles carry the promise's own words, beyond the search's. */
function gapOf(promise: string, a: AngleContext): number {
  const searched = new Set(contentTokens(a.search));
  const words = contentTokens(promise).filter((word) => !searched.has(word));
  if (words.length === 0) return a.ranks.length;
  return a.ranks.filter((rank) => {
    const held = new Set(contentTokens(rank));
    return words.some((word) => held.has(word));
  }).length;
}

const GAP_POINTS = (gap: number): number => (gap <= 1 ? 2 : gap === 2 ? 1 : 0);

/** The pattern that answers the intent best scores a point: a comparison on a list, a method on a problem. */
function intentPoint(pattern: AnglePattern, search: string): number {
  const text = lowered(search);
  if (pattern === "P3") return SHAPES.listicle.test(text) || SHAPES.solution.test(text) ? 1 : 0;
  if (pattern === "P1") return SHAPES.problem.test(text) || SHAPES.pain.test(text) ? 1 : 0;
  if (pattern === "P2") return SHAPES.informational.test(text) || SHAPES.price.test(text) ? 1 : 0;
  return 0;
}

/**
 * The one angle a search keeps, or `null` where none passes: its fact is a passage shown, its pattern fits the
 * search's intent, it leads with the search, every figure and name in it is in the search or a source, it is
 * not led by a price off a price or comparison page, a comparison names no rival the search does not and appends no claim,
 * it adds a word to the search, and it says no banned or hype phrase. Of those, the one whose promise the fewest top results make,
 * then the one whose pattern fits the intent, then the model's order. Pure.
 */
export function pickAngle(proposed: readonly ProposedAngle[], a: AngleContext): (ProposedAngle & { gap: number }) | null {
  const kept = proposed
    .map((angle, order) => ({ ...angle, title: angle.title.trim(), promise: angle.promise.trim(), order }))
    .filter((angle) => angle.title !== "" && ANGLE_PATTERNS.includes(angle.pattern))
    .filter((angle) => a.passages === undefined || angle.fact === null || (angle.fact >= 0 && angle.fact < a.passages))
    .filter((angle) => patternAllowed(angle.pattern, a.search) && leadsWithSearch(angle.title, a.search))
    .filter((angle) => namesAreReal(angle.title, a) && !priceLed(angle.title, a.search) && !namesOtherRival(angle, a) && !appendsClaim(angle.title, a.search) && !restates(angle.title, a.search) && !hyped(angle.title, a.search))
    .map((angle) => ({ ...angle, gap: gapOf(angle.promise, a) }));
  const score = (angle: (typeof kept)[number]): number => GAP_POINTS(angle.gap) + intentPoint(angle.pattern, a.search);
  const best = kept.sort((left, right) => score(right) - score(left) || left.order - right.order)[0];
  return best === undefined ? null : { pattern: best.pattern, title: best.title, promise: best.promise, fact: best.fact, gap: best.gap };
}
