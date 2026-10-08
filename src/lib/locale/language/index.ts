// src/lib/locale/language — each language's pack, and what is built from
// all of them (SPEC §6, owner D66, issue 1311).
//
// Pure: no I/O. `languagePack` is the one way a stage reaches a language's
// own words; `SHAPES` is every language's shape words as one pattern each,
// for the code that reads a search without knowing whose it is.
import { COUNTRIES, DEFAULT_LOCALE, LANGUAGES, type Language, type Locale } from "../locales";
import { DE } from "./de";
import { EN } from "./en";
import type { LanguagePack, PageKind, ShapeWords } from "./types";

export type { LanguagePack, PageKind, PromptWording, ShapeWords } from "./types";

const PACKS: Readonly<Record<Language, LanguagePack>> = Object.freeze({ en: EN, de: DE });

export function languagePack(language: Language): LanguagePack {
  return PACKS[language];
}

export const LANGUAGE_PACKS: readonly LanguagePack[] = Object.freeze(Object.values(PACKS));

const BEFORE = "(?<![\\p{L}\\p{N}])";
const AFTER = "(?![\\p{L}\\p{N}])";

/** One shape's words in every language, as whole words. `\b` knows ASCII
 *  letters only, so the edges are written out: "österreich" has no `\b`
 *  before it. */
function anywhere(...keys: readonly (keyof ShapeWords)[]): string {
  const words = LANGUAGE_PACKS.flatMap((pack) => keys.map((key) => pack.shapes[key]));
  return `${BEFORE}(?:${words.join("|")})${AFTER}`;
}

function atStart(...keys: readonly (keyof ShapeWords)[]): string {
  const words = LANGUAGE_PACKS.flatMap((pack) => keys.map((key) => pack.shapes[key]));
  return `^(?:${words.join("|")})${AFTER}`;
}

function pattern(...sources: readonly string[]): RegExp {
  return new RegExp(sources.join("|"), "u");
}

/**
 * The shapes a search is read by, in every supported language at once. The
 * text they are tested on is lower case with its punctuation taken out.
 */
export const SHAPES = Object.freeze({
  best: pattern(anywhere("best")),
  versus: pattern(anywhere("versus")),
  alternatives: pattern(anywhere("alternatives")),
  price: pattern(anywhere("price")),
  /** A comparison: one product against another, or the alternatives to one. */
  comparison: pattern(anywhere("versus", "alternatives")),
  /** Anchored on a product by its own words. */
  anchored: pattern(anywhere("versus", "alternatives", "price")),
  product: pattern(anywhere("versus", "alternatives", "price", "integration")),
  problem: pattern(atStart("askStart"), anywhere("pain")),
  pain: pattern(anywhere("pain")),
  howTo: pattern(atStart("howToStart")),
  solution: pattern(anywhere("solution")),
  informational: pattern(atStart("informationalStart"), anywhere("definition")),
  listicle: pattern(anywhere("versus", "alternatives", "compare", "best")),
  guide: pattern(atStart("guideStart"), anywhere("guide")),
  insights: pattern(anywhere("insights")),
  research: pattern(anywhere("research")),
  documentation: pattern(atStart("documentationStart"), anywhere("documentation")),
  format: new RegExp(anywhere("format"), "iu"),
  asksPrice: new RegExp(anywhere("asksPrice"), "iu"),
});

/** Every language's price words and price filler, for the code that reads a
 *  stored search without its site. */
export const PRICE_WORDS: ReadonlySet<string> = new Set(LANGUAGE_PACKS.flatMap((pack) => [...pack.priceWords]));
export const PRICE_FILLER: ReadonlySet<string> = new Set(LANGUAGE_PACKS.flatMap((pack) => [...pack.priceFiller]));

/**
 * What a model is told about whose market it is writing for, or `null`
 * where nothing needs saying: the United States in English is what every
 * prompt was written for, and stays word for word what it was.
 */
export function modelInstruction(locale: Locale): string | null {
  const usual = locale.country === DEFAULT_LOCALE.country && locale.language === DEFAULT_LOCALE.language;
  // D67 (issue 1318): a business that serves one place is written for there.
  const local =
    locale.place === undefined
      ? null
      : `This business serves ${locale.place.name}${locale.place.region === undefined ? "" : `, ${locale.place.region}`} and nowhere else: its buyers, its searches and its competitors are the ones in ${locale.place.name}.`;
  if (usual) return local;
  const country = COUNTRIES[locale.country].location;
  const language = LANGUAGES[locale.language].name;
  const national =
    locale.language === "en"
      ? `This business's buyers are in ${country}. Write in English as it is written there, and name searches, prices and places as buyers there do.`
      : `This business's buyers are in ${country} and search in ${language}. Write every search, term, question, name of a market and sentence you return in ${language}, as buyers there write it; never in English, and never as a translation of an English phrase. Keep brand names, addresses, ids and any value you are told to choose from exactly as given.`;
  return local === null ? national : `${national} ${local}`;
}

/** Every language's own path words for a kind of page, beside `english`:
 *  the words an address is read by whatever language its site is in. */
export function pagePathWords(kind: PageKind, english: readonly string[]): readonly string[] {
  return [...new Set([...english, ...LANGUAGE_PACKS.flatMap((pack) => pack.pages.paths[kind] ?? [])])];
}

/** The same for the phrases a title or first heading names a page by. */
export function pageHeadingPhrases(kind: PageKind, english: readonly string[]): readonly string[] {
  return [...new Set([...english, ...LANGUAGE_PACKS.flatMap((pack) => pack.pages.headings[kind] ?? [])])];
}

/** The other languages' path words for a kind of page as one alternation,
 *  to sit inside a pattern beside the English ones; `(?!)` where no
 *  language adds any, which matches nothing. */
export function pagePathAlternation(...kinds: readonly PageKind[]): string {
  const words = LANGUAGE_PACKS.flatMap((pack) => kinds.flatMap((kind) => pack.pages.paths[kind] ?? []));
  return words.length === 0 ? "(?!)" : [...new Set(words)].map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}
