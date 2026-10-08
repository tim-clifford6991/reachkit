// src/lib/locale/language/types.ts — what one language supplies (SPEC §6,
// owner D66, issue 1311). Adding a language is one more file of this shape
// and one row of `LANGUAGES`; no stage of a pass names a language itself.
import type { Language } from "../locales";

/**
 * The words a search's shape is read by, each a regular-expression
 * alternation over lower-case text with its punctuation taken out. A shape
 * is recognised in every language at once (`./shapes.ts`), so a word listed
 * here must not be an everyday word of another supported language.
 * A `…Start` entry matches at the start of the search only.
 */
export interface ShapeWords {
  best: string;
  versus: string;
  alternatives: string;
  price: string;
  integration: string;
  /** A how or a why, at the start. */
  askStart: string;
  /** A pain: something is wrong, broken or needs fixing. */
  pain: string;
  /** The anchored how-to, at the start. */
  howToStart: string;
  /** The offering nouns: software, tool, app, platform. */
  solution: string;
  /** What is, why, who, when, where — at the start. */
  informationalStart: string;
  definition: string;
  /** Compare, comparison, review. */
  compare: string;
  /** How-to as a page: the anchored form, at the start. */
  guideStart: string;
  /** How-to as a page: steps, set up, install, tutorial. */
  guide: string;
  insights: string;
  research: string;
  /** Documentation as a page, at the start: what is, how does. */
  documentationStart: string;
  documentation: string;
  /** The four format pages: comparison, alternative, integration, template. */
  format: string;
  /** A question about price inside a sentence. */
  asksPrice: string;
}

/** The tracked buyer prompts' wording (SPEC §6, D19), one language's. Each
 *  takes the market's own words and returns the prompt as a buyer asks it. */
export interface PromptWording {
  category: {
    best(category: string): string;
    recommended(synonym: string): string;
    newTo(category: string): string;
    worthPaying(category: string): string;
    bestReviewed(category: string): string;
    shortlist(category: string): string;
  };
  /** What a buyer is constrained by, each asked of the market by name. */
  useCases: readonly ((name: string) => string)[];
  persona: readonly ((buyer: string, category: string) => string)[];
  comparison: {
    compare(first: string, second: string, category: string): string;
    alternatives(first: string, buyer: string): string;
    better(second: string, third: string, category: string): string;
    value(category: string, first: string, second: string, third: string): string;
  };
  problem: readonly ((category: string) => string)[];
  branded: {
    what(name: string, category: string): string;
    alternative(name: string, first: string, category: string): string;
  };
  /** The buyer without its qualifying clause, as it sits inside a prompt. */
  buyerHead(buyer: string): string;
}

/** The kinds of page a site's own address or heading can name. */
export type PageKind =
  | "legal" | "contact" | "pricing" | "about" | "blog" | "features" | "product"
  | "docs" | "changelog" | "customers" | "reviews";

export interface LanguagePack {
  language: Language;
  /** The path words and the headings a site in this language names its own
   *  pages by, beside the English ones every site may use. */
  pages: {
    paths: Readonly<Partial<Record<PageKind, readonly string[]>>>;
    headings: Readonly<Partial<Record<PageKind, readonly string[]>>>;
  };
  shapes: ShapeWords;
  /** Function words: dropped before two searches are compared. */
  stopWords: ReadonlySet<string>;
  /** Words that carry a search's shape and not its subject. */
  genericTokens: ReadonlySet<string>;
  /** Words a price-only search may hold beside the product's name. */
  priceFiller: ReadonlySet<string>;
  /** Price words, which all name the one price topic. */
  priceWords: ReadonlySet<string>;
  /** A word without its plural or its case ending. */
  stem(token: string): string;
  /** Whether a word of a search is one of the words the business is known
   *  by. German joins words, so a part of a compound counts there. */
  supports(token: string, support: ReadonlySet<string>): boolean;

  /** What a page title is checked by (SPEC §7, D51). */
  title: {
    /** Words that are not a title's subject. */
    filler: ReadonlySet<string>;
    /** How a title that asks a question opens: an alternation. */
    asksStart: string;
    /** The words that say something costs nothing: an alternation. */
    free: string;
    /** Phrases a title never uses, lower case. */
    banned: readonly string[];
  };

  // ── Searches the product writes itself ──────────────────────────────────
  alternativesSearch(name: string): string;
  versusSearch(first: string, second: string): string;
  priceSearch(name: string): string;
  forBuyerSearch(name: string, buyer: string): string;
  /** The search for the job a product is hired for. */
  jobSearch(job: string): string;
  /** The search that finds studies about a target. */
  studySearch(target: string): string;

  // ── Questions and prompts ───────────────────────────────────────────────
  /** A search as the question a buyer would ask, by its shape. Total. */
  question(keyword: string): string;
  prompts: PromptWording;
  /** The few prompts a deep pass asks beside the twelve. */
  buyerPrompts: {
    best(name: string): string;
    forBuyer(category: string, buyer: string): string;
    job(job: string): string;
    alternatives(rival: string): string;
  };
}
