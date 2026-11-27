// SPEC §6 *Every topic is an angle* (owner rulings 91–92, #2722): the one place a found search becomes a page's angle.
// The model proposes two or three angles per search in one of five patterns; code keeps the one with the fewest faults
// that promises most of what the top results miss. Only a name no source holds excludes one. The weekly topic step and the hot-topic lane both call `pickAngle`.
import { carriesAsk, names, plannedTitleFaults } from "@/lib/generate/rules/title";
import { languagePack, SHAPES } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { contentTokens } from "@/lib/market/questions/select";
import { ownCasings, pageTitle } from "@/lib/presentation/page-title";

export const ANGLE_PATTERNS = ["P1", "P2", "P3", "P4", "P5"] as const;
export type AnglePattern = (typeof ANGLE_PATTERNS)[number];

/** How an angle is asked, word for word, by the fit call and by the commit's title call. */
export const ANGLE_ASK = {
  pages: "two different pages that would answer it for this buyer, each in one `pattern`: P1 a problem and how this business's method fixes it; P2 the question answered from the business's own facts; P3 a comparison where the business is a real option; P4 how to do the job with a new thing the search or `ranks` names; P5 the search for a place or segment the business serves. `fact` is the `i` of the `product.knowledge` passage the page is written from: it supports the page, and the title need not repeat its words.",
  title: "Each angle's `title` is a grammatical headline a person would say aloud, at most 65 characters, in Title Case. Keep each name's own casing (AI, ChatGPT, SEO) even where the search is lowercase. It leads with the search's main noun phrase, reordered or inflected as a headline needs, keeps the thing it asks for (strategies, a cost, a calculator, tools, alternatives), and states the reader's outcome, what they can do or decide, never a feature of this business, and one none of `ranks`, the titles that rank for the search now, already promises. `promise` says that outcome in at most eight words. One example per pattern, in other markets: P1 \"Losing Calls After Hours? How to Answer Every Lead\"; P2 \"What a Boiler Service Costs and What It Should Include\"; P3 \"Best Payroll Software for Small Teams: How to Choose\"; P4 \"How to Get Your Business Recommended by {a new thing the sources name}\"; P5 \"Emergency Plumber in Leeds: What to Expect Before They Arrive\". No hype word, no \"Why … Matters\", no word said twice, no clause about this business joined on after a dash. A title names a product, model, version, number, price or date only when it is written in the search, `product.knowledge` or `ranks`. A bare search with a number or a price appended is not an angle, and a price leads only a pricing or comparison search. A comparison title never says what a named competitor does, lacks or who uses it; it names the decision the page helps the reader make.",
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
  /** The site's language: the writer's wording rules and its casing are that language's. Absent is English. */
  language?: Language;
  /** The business's brand and offering texts, and the outcome its buyer wants: a title that sells the offering is a `claim`. */
  offering?: NonNullable<Parameters<typeof plannedTitleFaults>[3]>;
  /** A page on a market event: the event's name and the reports' quotes, which its title leads with and takes its figure from. */
  hot?: { event: string; claims: readonly string[] };
}

const lowered = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The pattern fits the search's intent: a comparison only on a list, a versus or an alternatives search; a method on a problem or a how-to. */
function patternAllowed(pattern: AnglePattern, search: string): boolean {
  const text = lowered(search);
  if (pattern === "P3") return SHAPES.listicle.test(text) || SHAPES.solution.test(text) || SHAPES.comparison.test(text);
  if (pattern === "P1") return SHAPES.problem.test(text) || SHAPES.howTo.test(text) || SHAPES.pain.test(text) || /^why\b/.test(text);
  return true;
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

/** A comparison that names a rival the search does not makes a claim about that rival nothing here supports. */
function namesOtherRival(angle: ProposedAngle, a: AngleContext): boolean {
  if (angle.pattern !== "P3") return false;
  const [title, searched] = [` ${lowered(angle.title)} `, ` ${lowered(a.search)} `];
  return (a.rivals ?? []).map(lowered).some((rival) => rival !== "" && !searched.includes(` ${rival} `) && title.includes(` ${rival} `));
}

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

/** The gates that exclude an angle, reason 3: nothing to keep, or a name or a rival no source holds. Every other gate ranks. */
export const UNSUPPORTED: readonly string[] = ["empty", "names", "rival"];

/** The gates an angle fails, by name: its fact is a passage shown, its pattern fits the search's intent, it passes the
 *  writer's own wording rules (`plannedTitleFaults`), every figure and name in it is in the search or a source, a
 *  comparison names no rival the search does not, it adds a word to the search, it keeps every word the search asks for, and
 *  a news page names its event and a figure the reports state. */
export function angleGates(angle: ProposedAngle, a: AngleContext): string[] {
  const title = angle.title.trim();
  if (title === "" || !ANGLE_PATTERNS.includes(angle.pattern)) return ["empty"];
  const gates: (string | false)[] = [
    a.passages !== undefined && angle.fact !== null && (angle.fact < 0 || angle.fact >= a.passages) && "fact",
    !patternAllowed(angle.pattern, a.search) && "pattern",
    a.hot !== undefined && !(names(title, a.hot.event) && (/\d/.test(title) || !/\d/.test(a.hot.claims.join(" ")))) && "promise_figure",
    ...plannedTitleFaults(title, a.search, a.language, a.offering && { ...a.offering, common: [...a.offering.common, ...a.ranks] }),
    !namesAreReal(title, a) && "names",
    namesOtherRival(angle, a) && "rival",
    restates(title, a.search) && "restates",
    !carriesAsk(title, a.search, a.language) && "ask",
  ];
  return gates.filter((gate) => gate !== false);
}

/** `text` in Title Case, each name in the casing the sources, the top results' titles or the promises write it. */
export function casedTitle(text: string, a: AngleContext, promises: readonly string[] = []): string {
  return pageTitle(text, a.language ?? "en", ownCasings([...a.sources, ...a.ranks, ...promises]));
}

/**
 * The one angle a search keeps, with the gates it still fails, or `null` where every one is `UNSUPPORTED`. Of the rest,
 * the one with the fewest faults, then the one whose promise the fewest top results make and whose pattern fits the
 * intent, then the model's order; its title in Title Case with its names' own casing. Pure.
 */
export function pickAngle(proposed: readonly ProposedAngle[], a: AngleContext): (ProposedAngle & { gap: number; faults: string[] }) | null {
  const kept = proposed
    .map((angle, order) => ({ ...angle, title: angle.title.trim(), promise: angle.promise.trim(), order }))
    .map((angle) => ({ ...angle, faults: angleGates(angle, a), gap: gapOf(angle.promise, a) }))
    .filter((angle) => !angle.faults.some((gate) => UNSUPPORTED.includes(gate)));
  const score = (angle: (typeof kept)[number]): number => GAP_POINTS(angle.gap) + intentPoint(angle.pattern, a.search);
  const best = kept.sort((left, right) => left.faults.length - right.faults.length || score(right) - score(left) || left.order - right.order)[0];
  if (best === undefined) return null;
  return { pattern: best.pattern, title: casedTitle(best.title, a, proposed.map((angle) => angle.promise)), promise: best.promise, fact: best.fact, gap: best.gap, faults: best.faults };
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The angle `pickAngle` keeps once each title's small faults are repaired: a hype phrase the searcher did not use is
 *  dropped, and an abbreviation of the search's own words ("AEO") is written out as the search writes them. */
export function repairedAngle(proposed: readonly ProposedAngle[], a: AngleContext): ReturnType<typeof pickAngle> {
  const searched = a.search.toLowerCase();
  const words = a.search.toLowerCase().split(/\s+/).filter((word) => word !== "");
  const pack = languagePack(a.language ?? "en");
  const hype = pack.title.banned.filter((phrase) => !searched.includes(phrase));
  const spelled = (token: string): string => {
    const short = token.toLowerCase();
    if (short.length < 2 || short.length > 5 || words.includes(short) || pack.title.filler.has(short)) return token;
    const at = words.findIndex((_, i) => words.slice(i, i + short.length).map((word) => word[0]).join("") === short);
    return at < 0 ? token : words.slice(at, at + short.length).join(" ");
  };
  const repair = (title: string): string =>
    hype
      .reduce((text, phrase) => text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped(phrase)}(?![\\p{L}\\p{N}])\\s*`, "giu"), ""), title)
      .replace(/\p{L}+/gu, spelled)
      .replace(/\s{2,}/g, " ")
      .trim();
  return pickAngle(proposed.map((angle) => ({ ...angle, title: repair(angle.title) })), a);
}
