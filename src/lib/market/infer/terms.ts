// src/lib/market/infer/terms.ts — a market's words, checked against search
// volume (SPEC §6, owner D49 of 2026-10-05, issue 1270).
//
// A concluded category is the model's label, taken from the site's own
// copy; nobody need search for it. reachkit.app's "AI discovery monitoring
// and content" has no searches, while "AI SEO" has 6,600 a month
// (`docs/walk/titles-and-vocabulary.md`). So the market also keeps the
// terms buyers type, each with its measured volume, and `searchTerm`: the
// most-searched one that means this market. What is printed — a tracked
// prompt, a Q&A's question, a page — uses those; a label nobody searches
// stays internal.
//
// Pure: no I/O. `read-terms.ts` buys the candidates and their volume.
import { MARKET_TERMS } from "@/lib/config/constants";
import { LANGUAGE_PACKS, SHAPES } from "@/lib/locale/language";
import { contentTokens } from "@/lib/market/questions/select";
import type { Place } from "@/lib/locale/locales";
import { localSearch } from "@/lib/locale/place";
import type { MarketConclusion, MarketTerm } from "./types";

/** One proposed term, and whether the phrase mostly means something else. */
export interface TermCandidate {
  term: string;
  polluted: boolean;
}

const key = (term: string): string => term.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * The candidates one answer proposes, each once: never a rival's name or
 * the business's own, which are brands and not market words. `keep` is a
 * term the market already holds as searched, asked again so it is not lost
 * because the model did not repeat it.
 */
export function candidateTerms(
  proposed: readonly { term: string; otherMeaning: boolean }[],
  a: { brands: readonly string[]; keep?: readonly MarketTerm[] }
): TermCandidate[] {
  const brands = a.brands.map(key).filter((b) => b.length >= 3);
  const out: TermCandidate[] = [];
  const add = (term: string, polluted: boolean): void => {
    const text = term.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
    if (text === "" || out.length >= MARKET_TERMS.MAX) return;
    if (out.some((held) => key(held.term) === key(text))) return;
    if (brands.some((brand) => ` ${key(text)} `.includes(` ${brand} `))) return;
    out.push({ term: text, polluted });
  };
  for (const held of a.keep ?? []) if (held.volume > 0) add(held.term, held.polluted === true);
  for (const entry of proposed) add(entry.term, entry.otherMeaning);
  return out;
}

/**
 * The candidates as a business that serves one place is measured on them
 * (SPEC §6, owner D67, issue 1318): each is the service plus the place, so
 * "emergency plumber" and "emergency plumber near me" are both "emergency
 * plumber austin", once.
 */
export function localTerms(candidates: readonly TermCandidate[], place: Place): TermCandidate[] {
  const out: TermCandidate[] = [];
  for (const candidate of candidates) {
    const term = localSearch(candidate.term, place);
    if (!out.some((held) => key(held.term) === key(term))) out.push({ term, polluted: candidate.polluted });
  }
  return out;
}

/**
 * The terms with their volume, most searched first, and the search term:
 * the most-searched one no other meaning pollutes. `null` where none is
 * searched. A candidate the vendor returned no row for has no searches.
 */
export function searchedTerms(
  candidates: readonly TermCandidate[],
  volumes: readonly { keyword: string; searchVolume: number }[]
): { terms: MarketTerm[]; searchTerm: string | null } {
  const volume = new Map(volumes.map((row) => [key(row.keyword), row.searchVolume]));
  const terms = candidates
    .map((c, order) => ({
      order,
      term: { term: c.term, volume: Math.max(0, volume.get(key(c.term)) ?? 0), ...(c.polluted ? { polluted: true as const } : {}) },
    }))
    .sort((a, b) => b.term.volume - a.term.volume || a.order - b.order)
    .map((entry): MarketTerm => entry.term);
  const best = terms.find((t) => t.polluted !== true && t.volume > 0);
  return { terms, searchTerm: best?.term ?? null };
}

/** "AI visibility tool" as a template names it: the templates add "tools",
 *  "software" and "platforms" themselves. */
function head(term: string): string {
  const cut = term.trim().replace(/\s+(?:tools?|software|platforms?|apps?)$/i, "");
  return cut === "" ? term.trim() : cut;
}

/**
 * The market's name and other names, as they may be printed. Where its
 * terms were read: the search term, then every other searched, unpolluted
 * term — or, where nothing is searched, the category alone. Where they were
 * never read, the conclusion's own words, as before D49.
 */
export function spoken(market: Pick<MarketConclusion, "category" | "synonyms" | "terms" | "searchTerm" | "termsAt">): {
  category: string;
  synonyms: readonly string[];
} {
  if (market.termsAt === undefined) return { category: market.category, synonyms: market.synonyms };
  const searchTerm = (market.searchTerm ?? "").trim();
  if (searchTerm === "") return { category: market.category, synonyms: [] };
  const category = head(searchTerm);
  const synonyms: string[] = [];
  for (const t of market.terms ?? []) {
    if (t.polluted === true || t.volume <= 0) continue;
    const name = head(t.term);
    if (key(name) === key(category) || synonyms.some((held) => key(held) === key(name))) continue;
    synonyms.push(name);
  }
  return { category, synonyms };
}

/** The market's name as a prompt says it, where the market holds a searched
 *  term; `null` where its terms were never read or none is searched. */
export function searchedName(market: Pick<MarketConclusion, "category" | "synonyms" | "terms" | "searchTerm" | "termsAt">): string | null {
  if (market.termsAt === undefined || (market.searchTerm ?? "").trim() === "") return null;
  return spoken(market).category;
}

/**
 * The market's names that are never printed (D49): its concluded category
 * and synonyms and its proposed terms, less the ones `spoken` prints. Empty
 * where the terms were never read. A tracked prompt built before they were
 * read still carries one until its set is rebuilt on the next pass (D54)
 * — so a page checks its questions against this list.
 */
export function unsearched(market: Pick<MarketConclusion, "category" | "synonyms" | "terms" | "searchTerm" | "termsAt">): string[] {
  if (market.termsAt === undefined) return [];
  const said = spoken(market);
  const printed = new Set([said.category, ...said.synonyms].map(key));
  const out: string[] = [];
  for (const name of [market.category, ...market.synonyms, ...(market.terms ?? []).map((t) => t.term)]) {
    const text = head(name);
    if (key(text) === "" || printed.has(key(text)) || out.some((held) => key(held) === key(text))) continue;
    // A label a printed name contains ("AI visibility" in "AI visibility
    // tracking") would refuse the searched term with it.
    if ([...printed].some((name) => ` ${name} `.includes(` ${key(text)} `))) continue;
    out.push(text);
  }
  return out;
}

/** A founder's answer as a template can name it: no closing stop, and a
 *  Title Case answer ("Founders and Business Owners") in lower case. */
function buyerPhrase(answer: string): string {
  const text = answer.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
  const words = text.split(" ").filter((w) => w.length > 3);
  const titled = words.length > 1 && words.every((w) => /^\p{Lu}\p{Ll}+$/u.test(w));
  return titled ? text.toLowerCase() : text;
}

/** The market as a prompt, a question or a page names it (D49): its
 *  searched words, and the founder's own answer about who buys where they
 *  gave one — it outranks the inferred buyer. */
export function spokenMarket<M extends MarketConclusion>(market: M, founderBuyer?: string | null): M {
  const buyer = buyerPhrase(founderBuyer ?? "");
  return { ...market, ...spoken(market), ...(buyer === "" ? {} : { buyer }) };
}

/** Whether a market's terms are read now: never read, or read longer ago
 *  than `MARKET_TERMS.REFRESH_DAYS`. A market just adopted holds none. */
export function termsDue(market: Pick<MarketConclusion, "termsAt">, at: Date): boolean {
  if (market.termsAt === undefined) return true;
  const read = Date.parse(market.termsAt);
  return Number.isNaN(read) || at.getTime() - read >= MARKET_TERMS.REFRESH_DAYS * 86_400_000;
}

/** What joining reads of a market: its own names and its buyer. */
export type MarketWords = Pick<MarketConclusion, "category" | "synonyms" | "terms" | "buyer" | "serves">;

/**
 * A search's content tokens in order, read in the market's own words (SPEC §6 *One URL per question*): its category,
 * each synonym and each term that only rewords them is one token, the category's, and a closing "for …" that names
 * only the buyer is dropped, so two wordings of one question key alike. `joined` is whether a market phrase was read. A comparison is
 * read as it is: it is one question only with the same products.
 */
export function marketTokens(text: string, market: MarketWords): { tokens: string[]; joined: boolean } {
  if (SHAPES.comparison.test(text.toLowerCase())) return { tokens: contentTokens(text), joined: false };
  const buyer = new Set(contentTokens(market.buyer));
  let kept = ` ${text.toLowerCase()} `;
  for (const pack of LANGUAGE_PACKS) {
    const joiner = ` ${pack.forBuyerSearch("", "").trim()} `;
    const at = kept.lastIndexOf(joiner);
    const qualifier = at < 0 ? [] : contentTokens(kept.slice(at + joiner.length));
    if (qualifier.length > 0 && qualifier.every((token) => buyer.has(token))) kept = kept.slice(0, at);
  }
  const names = [market.category, ...market.synonyms];
  const place = new Set([market.serves?.name ?? "", market.serves?.region ?? ""].flatMap((name) => contentTokens(name)));
  const own = new Set(names.flatMap((name) => contentTokens(name)));
  // A term with a word of its own is a narrower search, not another name: "eicr leeds" is not "electrician leeds".
  const terms = (market.terms ?? [])
    .map((t) => contentTokens(t.term).filter((word) => !place.has(word)))
    .filter((words) => words.every((word) => own.has(word)));
  const phrases = [...names.map((name) => contentTokens(name)), ...terms]
    .filter((phrase) => phrase.length > 0)
    .sort((a, b) => b.length - a.length);
  const name = contentTokens(market.category).join("_") || "market";
  const tokens = contentTokens(kept);
  const out: string[] = [];
  for (let at = 0; at < tokens.length; ) {
    const phrase = phrases.find((words) => words.every((word, i) => tokens[at + i] === word));
    out.push(phrase === undefined ? tokens[at]! : name);
    at += phrase?.length ?? 1;
  }
  return { tokens: out, joined: out.includes(name) };
}
