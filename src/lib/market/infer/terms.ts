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
