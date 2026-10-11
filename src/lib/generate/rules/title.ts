// SPEC §7 (owner, D51, issue 1266; revised by issue 1389) — the stage-4
// `title` check.
//
// A page's `<title>` is its search form and its H1 is the same words. Code
// holds the title to nine things: its length, the search's own wording near
// its head, one specific the pack holds, a question only where the search is
// one, the year's place, no banned pattern, not the title of another page of
// the site, an H1 that is the title, and the meta description's length —
// which rides with it, because a page has one fix call and the two are
// written together.
//
// The writer proposes several titles and `pickTitle` chooses among them by
// these same rules (issue 1389): no model judges a title.
//
// It binds what ReachKit generates and asks nothing of a founder's own edit
// or of an update, whose title is the live page's (`../pipeline/compose.ts`).
//
// How code reads the ruling's words (drafted, the owner may correct):
//   * **The search's wording in the first 30 characters.** Of D49's
//     `searchTerm`, the target query or a question buyers were seen to ask,
//     whichever the title carries: the wording's first three words that are
//     not filler ("best", "for", "the") are all in the title, and the first
//     of them starts inside its first 30 characters.
//   * **A specific, from the pack.** A number the pack states or the page
//     counts out, a year aside; a price is such a number, and "free" where
//     the pack says it; an engine's name; on a comparison, a rival the pack
//     names; the place the business serves. A name the search itself
//     carries is the search and no detail added to it. Asking a question is
//     not one, and neither is who the page is for. A number that only counts
//     an episode, an issue, a volume or a chapter ("ep. 16") is not one.
//     The picker and the fix call try for it, and it does not stop a page:
//     where it is all the title still lacks after the fix call, the title
//     goes on (owner's autopilot rule, 2026-10-08; ruling 2026-10-11).
//   * **A question** is a title that opens as one ("How to", "What is") or
//     carries a question mark. It stands only where the search is one.
//   * **A bare tail** is a title that ends on the year with no bracket.
//   * **A word repeated** is a word of three letters or more, filler aside.
//   * **A banned pattern the search itself carries** is the searcher's word
//     and no trope: "how to unlock a phone" may be titled with "unlock".
//   * **Token overlap** is the share of the two titles' words they have in
//     common (Jaccard), the measure `./similarity.ts` uses for a page.
//
// Deterministic, no I/O. A failure carries handles, never a sentence.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { TITLE } from "@/lib/config/constants";
import type { ContentType } from "@/lib/opportunities/content-type";
import { numeralsOf } from "./figures";
import type { RuleFailure } from "./types";

/** What a title or its description failed, by handle. */
export type TitleFault = "length" | "term" | "specific" | "question" | "year" | "banned" | "overlap" | "heading" | "description";

export interface TitleRuleInputs {
  type: ContentType;
  /** The searches the title may lead with: D49's `searchTerm` where the
   *  market holds one, and the target query. */
  terms: readonly string[];
  /** The follow-up questions buyers were seen to ask about the target,
   *  where the pack holds them. A title may lead with one as with a search. */
  follow: readonly string[];
  /** Whether the search itself is a question. */
  asks: boolean;
  /** The rivals the pack names, on a page that compares them. */
  rivals: readonly string[];
  /** The place the business serves, where it serves one. */
  places: readonly string[];
  /** The pack's own words — its facts, its claims, what the business says of
   *  itself, what was measured — and the counts of the page's own parts: a
   *  number in the title is a specific where this holds it. */
  holds: string;
  /** The current year. */
  year: number;
  /** Every title the site has published or planned. */
  titles: readonly string[];
  /** The page's meta description. */
  description: string;
  /** The page's language (SPEC §6, owner D66): the filler words, the banned
   *  phrases and how a question opens are that language's. Absent is English. */
  language?: Language;
  /** Set once the page has had its fix call: a title that lacks only its
   *  specific then goes on (ruling 2026-10-11). */
  settled?: boolean;
}

const YEAR_RE = /\b(?:19|20)\d\d\b/g;
const WORD_RE = /[\p{L}\p{N}]+/gu;

const languageOf = (a: Pick<TitleRuleInputs, "language">): Language => a.language ?? "en";

/** A whole word or phrase of `alternation`, at the start or anywhere. */
function wordsPattern(alternation: string, anchored: boolean): RegExp {
  return new RegExp(`${anchored ? "^" : "(?<![\\p{L}\\p{N}])"}(?:${alternation})(?![\\p{L}\\p{N}])`, "iu");
}

/** A title's words and where each starts: lowercased, a plural read as its
 *  singular. English reads its plurals as it always did; another language
 *  by its own endings. */
function placedWords(text: string, language: Language = "en"): { word: string; at: number }[] {
  const stem =
    language === "en"
      ? (word: string): string => (word.length > 3 && !word.endsWith("ss") ? word.replace(/(?:ies|s)$/, (end) => (end === "ies" ? "y" : "")) : word)
      : languagePack(language).stem;
  return [...text.toLowerCase().matchAll(WORD_RE)].map((match) => ({ word: stem(match[0]), at: match.index }));
}

const wordsOf = (text: string, language: Language = "en"): string[] => placedWords(text, language).map((placed) => placed.word);

/** The language's filler, as `wordsOf` spells a word. */
function fillerOf(language: Language): ReadonlySet<string> {
  const pack = languagePack(language);
  return language === "en" ? pack.title.filler : new Set([...pack.title.filler].flatMap((word) => [word, pack.stem(word)]));
}

const subjectOf = (text: string, language: Language = "en"): string[] => {
  const filler = fillerOf(language);
  return [...new Set(wordsOf(text, language).filter((word) => !filler.has(word)))];
};

/** The title leads with the term: its first words are all there, and the
 *  first of them starts inside the head. A term of filler alone asks nothing. */
function leadsWith(title: string, term: string, language: Language): boolean | null {
  const subject = subjectOf(term, language).slice(0, TITLE.termWords);
  if (subject.length === 0) return null;
  const placed = placedWords(title, language);
  return (
    subject.every((word) => placed.some((at) => at.word === word)) &&
    placed.some((at) => at.word === subject[0] && at.at < TITLE.headChars)
  );
}

function names(title: string, phrase: string): boolean {
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped !== "" && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(title);
}

/** The rivals and the place a title may name as its specific: a name the
 *  search itself carries is the search, not a detail added to it. */
export function addedNames(a: Pick<TitleRuleInputs, "terms" | "rivals" | "places">, among: readonly string[] = [...a.rivals, ...a.places]): string[] {
  return among.filter((name) => !a.terms.some((term) => names(term, name)));
}

/** A text without the numbers that only count an episode, an issue, a
 *  volume or a chapter: such a number says nothing of the business. */
export function withoutSerials(text: string, language: Language = "en"): string {
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${languagePack(language).title.serial})\\.?\\s*#?\\d+`, "giu"), " ");
}

function hasSpecific(title: string, a: TitleRuleInputs): boolean {
  const language = languageOf(a);
  const held = new Set(numeralsOf(withoutSerials(a.holds, language)).map((numeral) => numeral.normalised));
  if (numeralsOf(withoutSerials(title, language).replace(YEAR_RE, "")).some((numeral) => held.has(numeral.normalised))) return true;
  const free = wordsPattern(languagePack(language).title.free, false);
  if (free.test(title) && free.test(a.holds)) return true;
  return addedNames(a, [...TITLE.engines, ...a.rivals, ...a.places]).some((name) => names(title, name));
}

/** Whether a text is a question: it opens as one, or carries the mark. */
export function asksQuestion(text: string, language: Language = "en"): boolean {
  return text.includes("?") || wordsPattern(languagePack(language).title.asksStart, true).test(text.trim());
}

function yearMisplaced(title: string, a: TitleRuleInputs): boolean {
  const years = title.match(YEAR_RE) ?? [];
  if (years.length === 0) return false;
  if (!(TITLE.yearTypes as readonly ContentType[]).includes(a.type)) return true;
  return years.some((year) => Number(year) !== a.year) || /(?:19|20)\d\d$/.test(title.trim());
}

function hasBanned(title: string, a: TitleRuleInputs): boolean {
  const language = languageOf(a);
  const pack = languagePack(language);
  const lower = title.toLowerCase();
  // The searcher's own word is no trope.
  const searched = a.terms.map((term) => term.toLowerCase());
  const trope = (said: string | undefined): boolean => said !== undefined && !searched.some((term) => term.includes(said.trim()));
  if (/[[\]|]/.test(title) || pack.title.banned.some((phrase) => lower.includes(phrase) && trope(phrase))) return true;
  if ([...pack.title.tropes.map((each) => wordsPattern(each, false)), wordsPattern(pack.title.double, true)].some((each) => trope(each.exec(lower)?.[0]))) return true;
  const filler = fillerOf(language);
  const words = wordsOf(title, language).filter((word) => word.length > 2 && !filler.has(word));
  return new Set(words).size < words.length;
}

/** The share of two titles' words they have in common. */
export function titleOverlap(a: string, b: string): number {
  const left = new Set(wordsOf(a));
  const right = new Set(wordsOf(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared);
}

/** The site's title closest to this one, where it is too close. */
export function closestTitle(title: string, titles: readonly string[]): string | null {
  return titles.find((other) => titleOverlap(title, other) >= TITLE.overlapMax) ?? null;
}

/** What a title's own words fail. The H1 is held to the same. */
function wordingFaults(title: string, a: TitleRuleInputs): TitleFault[] {
  const chars = [...title.trim()].length;
  const language = languageOf(a);
  const led = [...a.terms, ...a.follow].map((term) => leadsWith(title, term, language)).filter((answer) => answer !== null);
  const faults: (TitleFault | false)[] = [
    (chars < TITLE.chars.min || chars > TITLE.chars.max) && "length",
    led.length > 0 && !led.includes(true) && "term",
    !hasSpecific(title, a) && "specific",
    !a.asks && asksQuestion(title, language) && "question",
    yearMisplaced(title, a) && "year",
    hasBanned(title, a) && "banned",
    closestTitle(title, a.titles) !== null && "overlap",
  ];
  return faults.filter((fault) => fault !== false);
}

/** What the title, the H1 and the description fail, in a fixed order. The
 *  H1 is the title: another wording passes only where it is the title's near
 *  twin and holds every rule the title holds. */
export function titleFaults(title: string, a: TitleRuleInputs, heading: string = title): TitleFault[] {
  const description = [...a.description.trim()].length;
  const apart = heading.trim() !== title.trim() && (titleOverlap(heading, title) < TITLE.headingMin || wordingFaults(heading, a).length > 0);
  return [
    ...wordingFaults(title, a),
    ...(apart ? (["heading"] as const) : []),
    ...(description < TITLE.description.min || description > TITLE.description.max ? (["description"] as const) : []),
  ];
}

/** Whether a title lacks its specific and nothing else. */
export const specificOnly = (faults: readonly TitleFault[]): boolean => faults.length === 1 && faults[0] === "specific";

export function checkTitle(a: { title: string; heading?: string; rule: TitleRuleInputs | null }): RuleFailure | null {
  if (a.rule === null || a.rule.type === "update") return null;
  const all = titleFaults(a.title, a.rule, a.heading);
  // The specific is tried for and never stops a page on its own.
  const faults = a.rule.settled === true && specificOnly(all) ? [] : all;
  return faults.length === 0 ? null : { rule: "title", detail: { rule: "title", faults } };
}

/** One title the writer proposed, as code read it. */
export interface TitleCandidate {
  title: string;
  /** What its own words fail; empty where it passes. */
  faults: TitleFault[];
  /** How close it sits to the search and its follow-up questions: the share
   *  of the nearest search's words it carries, plus the mean share of each
   *  follow-up question's. */
  closeness: number;
  /** On the title that went on without its specific, after the fix call. */
  specific_unmet?: true;
}

/** The share of a text's subject words the title carries. */
function carried(title: ReadonlySet<string>, text: string, language: Language): number | null {
  const subject = subjectOf(text, language);
  return subject.length === 0 ? null : subject.filter((word) => title.has(word)).length / subject.length;
}

/**
 * The writer proposes, code picks (issue 1389). Of the titles proposed, the
 * one that fails no rule and sits closest to the search and its follow-up
 * questions; among equals, one inside the aimed length, then a statement,
 * then the writer's own order. Where none passes, the one that fails fewest
 * of the rules that stop a page, then fewest in all — so a title that lacks
 * only its specific is kept before one that fails any other rule. Stage 4
 * then stops the page on it and the one fix call is told why.
 */
export function pickTitle(proposed: readonly string[], a: TitleRuleInputs): { chosen: string; candidates: TitleCandidate[] } {
  const language = languageOf(a);
  const shares = (title: string, texts: readonly string[]): number[] => {
    const words = new Set(wordsOf(title, language));
    return texts.map((text) => carried(words, text, language)).filter((share) => share !== null);
  };
  const candidates = [...new Set(proposed.map((title) => title.trim()).filter(Boolean))].slice(0, TITLE.candidates).map((title) => {
    const follow = shares(title, a.follow);
    const closeness = Math.max(0, ...shares(title, a.terms)) + (follow.length === 0 ? 0 : follow.reduce((sum, share) => sum + share, 0) / follow.length);
    return { title, faults: wordingFaults(title, a), closeness: Math.round(closeness * 100) / 100 };
  });
  const aimed = (title: string): number => ([...title].length >= TITLE.aim.min && [...title].length <= TITLE.aim.max ? 0 : 1);
  const stopping = (each: TitleCandidate): number => each.faults.filter((fault) => fault !== "specific").length;
  const ranked = [...candidates].sort(
    (left, right) =>
      stopping(left) - stopping(right) ||
      left.faults.length - right.faults.length ||
      right.closeness - left.closeness ||
      aimed(left.title) - aimed(right.title) ||
      Number(asksQuestion(left.title, language)) - Number(asksQuestion(right.title, language))
  );
  return { chosen: ranked[0]?.title ?? "", candidates };
}

/** What the one fix call is told of each fault. Model-facing, never shown. */
export function titleNotes(title: string, a: TitleRuleInputs, faults: readonly TitleFault[]): string[] {
  const close = closestTitle(title, a.titles);
  const pack = languagePack(languageOf(a));
  const said: Record<TitleFault, string> = {
    length: `title: "${title}" has ${[...title.trim()].length} characters and must have ${TITLE.chars.min} to ${TITLE.chars.max}`,
    term: `title: one of these searches must start within its first ${TITLE.headChars} characters, in the searcher's own words: ${a.terms.map((term) => `"${term}"`).join(", ")}`,
    specific: "title: it must carry one specific that `pack` holds — a number, a price or a measured result stated there, an AI engine's name, a rival's name, or the place the business serves, one the search does not already name; a question or an audience is not one",
    question: "title: the search is not a question, so the title is a statement that answers it — not \"How to\", \"What is\" or a question mark",
    year: (TITLE.yearTypes as readonly ContentType[]).includes(a.type)
      ? `title: the only year it may carry is ${a.year}, in brackets or before a colon, never as its last word`
      : "title: a page of this type carries no year in its title",
    banned: `title: it must not use ${pack.title.banned.map((phrase) => `"${phrase}"`).join(", ")}, a filler verb or stock phrase like ${pack.title.tropeSamples.map((phrase) => `"${phrase}"`).join(", ")}, two things joined by "and" after "How to", a square bracket, a pipe, or the same word twice`,
    overlap: `title: it reads almost the same as this site's page "${close ?? ""}"; lead with what this page has that one does not`,
    heading: "heading: the H1 is the title itself",
    description: `description: it has ${[...a.description.trim()].length} characters and must have ${TITLE.description.min} to ${TITLE.description.max}, opening with the answer`,
  };
  return faults.map((fault) => said[fault]);
}
