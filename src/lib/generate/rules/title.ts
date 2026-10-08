// SPEC §7 (owner, D51; issue 1266) — the stage-4 `title` check.
//
// A page's `<title>` is its search form, and code holds it to six things:
// its length, the target's search term near its head, one specific, the
// year's place, no banned pattern, and not the title of another page of the
// site. The meta description's length rides with it, because a page has one
// fix call and the two are written together.
//
// It binds what ReachKit generates and asks nothing of a founder's own edit
// or of an update, whose title is the live page's (`../pipeline/compose.ts`).
//
// How code reads the ruling's words (drafted, the owner may correct):
//   * **The search term within the first five words.** Of D49's `searchTerm`
//     or the target query, whichever the title carries: the term's first
//     three words that are not filler ("best", "for", "the") are all in the
//     title, and its first one is among the title's first five words.
//   * **A specific.** A number that is not a year; an engine's name; a rival
//     the pack names; a price; a word of the audience the market or the
//     knowledge base records; or a question — a title that asks ("How to",
//     "What is") or ends in a question mark.
//   * **A bare tail** is a title that ends on the year with no bracket.
//   * **A word repeated** is a word of three letters or more, filler aside.
//   * **Token overlap** is the share of the two titles' words they have in
//     common (Jaccard), the measure `./similarity.ts` uses for a page.
//
// Deterministic, no I/O. A failure carries handles, never a sentence.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import { TITLE } from "@/lib/config/constants";
import type { ContentType } from "@/lib/opportunities/content-type";
import type { RuleFailure } from "./types";

/** What a title or its description failed, by handle. */
export type TitleFault = "length" | "term" | "specific" | "year" | "banned" | "overlap" | "description";

export interface TitleRuleInputs {
  type: ContentType;
  /** The searches the title may lead with: D49's `searchTerm` where the
   *  market holds one, and the target query. */
  terms: readonly string[];
  /** The rivals the pack names. */
  rivals: readonly string[];
  /** Who buys, as the market and the knowledge base record it. */
  audience: readonly string[];
  /** The current year. */
  year: number;
  /** Every title the site has published or planned. */
  titles: readonly string[];
  /** The page's meta description. */
  description: string;
  /** The page's language (SPEC §6, owner D66): the filler words, the banned
   *  phrases and how a question opens are that language's. Absent is English. */
  language?: Language;
}

const YEAR_RE = /\b(?:19|20)\d\d\b/g;
const MONEY_RE = /(?:[$€£]\s?\d|\d\s?(?:usd|eur|gbp|chf|€|\$|£))/i;

const languageOf = (a: Pick<TitleRuleInputs, "language">): Language => a.language ?? "en";

/** A whole word or phrase of `alternation`, wherever `flags` say. */
function wordsPattern(alternation: string, anchored: boolean): RegExp {
  return new RegExp(`${anchored ? "^" : "(?<![\\p{L}\\p{N}])"}(?:${alternation})(?![\\p{L}\\p{N}])`, "iu");
}

/** A title's words: lowercased, a plural read as its singular. English
 *  reads its plurals as it always did; another language by its own endings. */
function wordsOf(text: string, language: Language = "en"): string[] {
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (language !== "en") return words.map((word) => languagePack(language).stem(word));
  return words.map((word) => (word.length > 3 && !word.endsWith("ss") ? word.replace(/(?:ies|s)$/, (end) => (end === "ies" ? "y" : "")) : word));
}

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
 *  first of them is inside the head. A term of filler alone asks nothing. */
function leadsWith(title: readonly string[], term: string, language: Language): boolean | null {
  const subject = subjectOf(term, language).slice(0, TITLE.termWords);
  if (subject.length === 0) return null;
  return subject.every((word) => title.includes(word)) && title.slice(0, TITLE.headWords).includes(subject[0]!);
}

function names(title: string, phrase: string): boolean {
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped !== "" && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(title);
}

function hasSpecific(title: string, a: TitleRuleInputs): boolean {
  if (/\d/.test(title.replace(YEAR_RE, ""))) return true;
  const pack = languagePack(languageOf(a));
  if (title.includes("?") || wordsPattern(pack.title.asksStart, true).test(title.trim())) return true;
  if (MONEY_RE.test(title) || wordsPattern(pack.title.free, false).test(title)) return true;
  if (TITLE.engines.some((engine) => names(title, engine)) || a.rivals.some((rival) => names(title, rival))) return true;
  const said = new Set(subjectOf(title, languageOf(a)));
  return a.audience.some((text) => subjectOf(text, languageOf(a)).some((word) => word.length > 3 && said.has(word)));
}

function yearMisplaced(title: string, a: TitleRuleInputs): boolean {
  const years = title.match(YEAR_RE) ?? [];
  if (years.length === 0) return false;
  if (!(TITLE.yearTypes as readonly ContentType[]).includes(a.type)) return true;
  return years.some((year) => Number(year) !== a.year) || /(?:19|20)\d\d$/.test(title.trim());
}

function hasBanned(title: string, language: Language): boolean {
  const lower = title.toLowerCase();
  if (/[[\]|]/.test(title) || languagePack(language).title.banned.some((phrase) => lower.includes(phrase))) return true;
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

/** What the title and its description fail, in a fixed order. */
export function titleFaults(title: string, a: TitleRuleInputs): TitleFault[] {
  const chars = [...title.trim()].length;
  const language = languageOf(a);
  const words = wordsOf(title, language);
  const led = a.terms.map((term) => leadsWith(words, term, language)).filter((answer) => answer !== null);
  const description = [...a.description.trim()].length;
  const faults: (TitleFault | false)[] = [
    (chars < TITLE.chars.min || chars > TITLE.chars.max) && "length",
    led.length > 0 && !led.includes(true) && "term",
    !hasSpecific(title, a) && "specific",
    yearMisplaced(title, a) && "year",
    hasBanned(title, language) && "banned",
    closestTitle(title, a.titles) !== null && "overlap",
    (description < TITLE.description.min || description > TITLE.description.max) && "description",
  ];
  return faults.filter((fault) => fault !== false);
}

export function checkTitle(a: { title: string; rule: TitleRuleInputs | null }): RuleFailure | null {
  if (a.rule === null || a.rule.type === "update") return null;
  const faults = titleFaults(a.title, a.rule);
  return faults.length === 0 ? null : { rule: "title", detail: { rule: "title", faults } };
}

/** What the one fix call is told of each fault. Model-facing, never shown. */
export function titleNotes(title: string, a: TitleRuleInputs, faults: readonly TitleFault[]): string[] {
  const close = closestTitle(title, a.titles);
  const said: Record<TitleFault, string> = {
    length: `title: "${title}" has ${[...title.trim()].length} characters and must have ${TITLE.chars.min} to ${TITLE.chars.max}`,
    term: `title: one of these searches must start within its first ${TITLE.headWords} words: ${a.terms.map((term) => `"${term}"`).join(", ")}`,
    specific: "title: it must carry one specific — a number, an AI engine's name, a rival's name, a price, who the page is for, or a question",
    year: (TITLE.yearTypes as readonly ContentType[]).includes(a.type)
      ? `title: the only year it may carry is ${a.year}, in brackets or before a colon, never as its last word`
      : "title: a page of this type carries no year in its title",
    banned: `title: it must not use ${languagePack(languageOf(a)).title.banned.map((phrase) => `"${phrase}"`).join(", ")}, a square bracket, a pipe, or the same word twice`,
    overlap: `title: it reads almost the same as this site's page "${close ?? ""}"; lead with what this page has that one does not`,
    description: `description: it has ${[...a.description.trim()].length} characters and must have ${TITLE.description.min} to ${TITLE.description.max}, opening with the answer`,
  };
  return faults.map((fault) => said[fault]);
}
