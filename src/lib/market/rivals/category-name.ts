// src/lib/market/rivals/category-name.ts — a rival whose name is the
// category's own words has no brand to read (SPEC §6, 2026-10-09, issue
// 1369).
//
// The customer panel's pass of tattly.com concluded the shop at
// temporarytattoos.com as the rival "Temporary Tattoos". Every step that
// reads a rival's name then read the category as that rival's brand: its
// brand volume was the category's 60,500 searches a month, so it led the
// rivals; and seven of the twelve measured searches held its "name". The
// same class as issue 1285's polluted brand, from the other side: there a
// brand's name was an ordinary word, here the name is the market's.
//
// So a name that says nothing but the market's own words — its category,
// the other names buyers type for it, and the term it is measured under —
// is not a name any step may read. The rival stands, and is called by its
// domain, which is what tells it apart; a keyword its brand was to be read
// under that is only those words is not read.
//
// It under-reports: a name with one word of its own ("Radiant Plumbing",
// "Bäckerei Hinkel", "Stadtbäckerei") is a name. Pure: no I/O.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import type { BrandDemand, MarketConclusion, RivalConclusion } from "@/lib/market/infer/types";
import { lettersOf } from "@/lib/market/questions/well-formed";

/** What of a market says what it is called. */
export type MarketNames = Pick<MarketConclusion, "category" | "synonyms" | "searchTerm">;

function phrasesOf(market: MarketNames): string[] {
  return [market.category, ...market.synonyms, market.searchTerm ?? ""].filter((phrase) => phrase.trim() !== "");
}

/** A phrase's words as two phrases are compared: lower case, function
 *  words dropped, each without its plural or case ending. */
function wordsOf(text: string, language: Language): string[] {
  const pack = languagePack(language);
  const tokens = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/);
  return tokens.filter((token) => token !== "" && !pack.stopWords.has(token)).map((token) => pack.stem(token));
}

/**
 * Whether a name is only the market's own words: every word of it is a word
 * of the category, of another name buyers type for it or of its search
 * term, beside words that name nothing ("best", "online"), and at least one
 * is. So is the same words closed up ("TemporaryTattoos"). A web address is
 * never one: whoever types "temporarytattoos.com" means that site.
 */
export function isCategoryName(name: string, market: MarketNames, language: Language = "en"): boolean {
  const phrases = phrasesOf(market);
  const closed = lettersOf(name);
  if (!/[.]\p{L}/u.test(name.trim()) && closed.length >= 3 && phrases.some((phrase) => lettersOf(phrase) === closed)) return true;
  const generic = languagePack(language).genericTokens;
  const own = new Set(phrases.flatMap((phrase) => wordsOf(phrase, language)));
  let held = 0;
  for (const word of wordsOf(name, language)) {
    if (own.has(word)) held++;
    else if (!generic.has(word)) return false;
  }
  return held > 0;
}

/**
 * The rivals as every later step may read them. One whose name is the
 * category's words is named by its domain, and no rival's brand is read
 * under a keyword that is only those words; a rival left with no keyword
 * is read under its domain.
 */
export function withoutCategoryNames(rivals: readonly RivalConclusion[], market: MarketNames, language: Language = "en"): RivalConclusion[] {
  return rivals.map((rival) => {
    const named = isCategoryName(rival.name, market, language);
    const typed = rival.searchNames?.filter((keyword) => !isCategoryName(keyword, market, language));
    if (!named && typed?.length === rival.searchNames?.length) return rival;
    return {
      ...rival,
      ...(named ? { name: rival.domain } : {}),
      ...(named || typed !== undefined ? { searchNames: typed !== undefined && typed.length > 0 ? typed : named ? [rival.domain] : [] } : {}),
    };
  });
}

/**
 * The brand volumes a market holds, without the ones read under the
 * category's words by a pass before this rule: left there, the category
 * would be read as a product the market once held. The business's own
 * keywords stand.
 */
export function withoutCategoryBrands(
  demand: BrandDemand | undefined,
  market: MarketNames,
  a: { own: readonly string[]; language?: Language }
): BrandDemand | undefined {
  if (demand === undefined) return undefined;
  const brands = Object.entries(demand.brands).filter(([keyword]) => a.own.includes(keyword) || !isCategoryName(keyword, market, a.language ?? "en"));
  return brands.length === Object.keys(demand.brands).length ? demand : { ...demand, brands: Object.fromEntries(brands) };
}
