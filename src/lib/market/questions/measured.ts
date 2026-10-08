// SPEC §6 (owner D65 of 2026-10-07, issue 1303) — which searches a pass
// measures, for any market.
//
// A pass used to seed its measured searches from the concluded category, a
// label taken from the site's own copy that nobody need search for (D49).
// So it bought suggestions for a phrase with no searches, fell back on
// whatever its rivals rank for, and measured searches beside its market
// while the market's largest searches went unmeasured. Three rules follow,
// and none of them reads a particular market's words:
//
//   * **Seeds.** The market's searched terms (D49: the search term, the
//     other names buyers type, the outcome in a buyer's words), most
//     searched first. The category only where nothing is searched.
//   * **The terms themselves are measured.** Each searched term that no
//     other meaning pollutes is a measured search at its own volume.
//   * **What is never measured.** A search that uses a term from
//     `notOurMarket`, one that is only a rival's or another product's
//     name, and one the market's own judgement says means something else,
//     belongs to another market or is a company's name.
//
// Pure, like `select.ts`, which reads this: no context, no clock, no I/O.
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch, type NamedRival } from "./well-formed";

/** What selection reads of the market in force. */
export interface MeasuredMarket {
  /** The searched, unpolluted terms, most searched first. */
  terms: readonly { term: string; volume: number }[];
  notOurMarket: readonly string[];
  /** Every name a rival, or a product a pass read as a candidate, is
   *  searched under, normalised. */
  brands: readonly string[];
  /** `MarketConclusion.judged`. */
  judged: Readonly<Record<string, boolean>>;
  /** The rivals in force, by name and domain (issue 1314): a search that
   *  calls one by its domain is not a search. */
  rivals?: readonly NamedRival[];
}

/** A search as these rules compare it: lower case, punctuation to spaces. */
export function searchKey(search: string): string {
  return search.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** A domain's first label: "peec" for `peec.ai`. */
function labelOf(domain: string): string {
  return searchKey(domain.replace(/^www\./, "").split(".")[0] ?? "");
}

/** The market as selection reads it; `undefined` where the site has none. */
export function measuredMarketOf(market: MarketConclusion | null | undefined): MeasuredMarket | undefined {
  if (market === null || market === undefined) return undefined;
  const brands = new Set<string>();
  for (const rival of market.rivals) {
    for (const name of [rival.name, rival.domain, labelOf(rival.domain), ...(rival.searchNames ?? [])]) brands.add(searchKey(name));
  }
  for (const keyword of Object.keys(market.demand?.brands ?? {})) brands.add(searchKey(keyword));
  brands.delete("");
  return {
    terms: (market.terms ?? [])
      .filter((term) => term.polluted !== true && term.volume > 0)
      .map((term) => ({ term: term.term, volume: term.volume }))
      .sort((a, b) => b.volume - a.volume),
    notOurMarket: market.notOurMarket,
    brands: [...brands],
    judged: market.judged ?? {},
    rivals: market.rivals.map((rival) => ({ name: rival.name, domain: rival.domain, ...(rival.searchNames === undefined ? {} : { searchNames: rival.searchNames }) })),
  };
}

/**
 * The seeds a pass buys suggestions for, in order: the market's searched
 * terms, most searched first. Empty where its terms were never read or
 * none is searched — the pass then seeds from the category, as before.
 */
export function marketSeeds(market: MarketConclusion | null | undefined): string[] {
  const seeds: string[] = [];
  for (const { term } of measuredMarketOf(market)?.terms ?? []) {
    if (!seeds.some((held) => searchKey(held) === searchKey(term))) seeds.push(term);
  }
  return seeds;
}

const MARKET_SUFFIX = /\s+(?:tools?|software|platforms?|apps?|systems?|services?)$/;

/** Why a search is never measured in this market, or `null` where it may
 *  be. A term from `notOurMarket` is read as D59 reads it: the phrase, or
 *  the phrase without its closing "software" or "tools" where two words or
 *  more are left; one word alone is never a match. */
export function neverMeasured(search: string, m: MeasuredMarket): "not_our_market" | "brand" | "judged" | "malformed" | null {
  const key = searchKey(search);
  if (m.judged[key] === false) return "judged";
  if (m.brands.includes(key)) return "brand";
  const text = ` ${key} `;
  for (const contrast of m.notOurMarket) {
    const phrase = searchKey(contrast);
    const head = phrase.replace(MARKET_SUFFIX, "");
    for (const term of [phrase, ...(head.includes(" ") ? [head] : [])]) {
      if (term.length > 2 && text.includes(` ${term} `)) return "not_our_market";
    }
  }
  // Issue 1314: nor a search nobody would type as it stands.
  if (malformedSearch(search, m.rivals) !== null) return "malformed";
  return null;
}

/** The searches of `selected` the market holds no judgement for. A market
 *  term is the market's own word and needs none. */
export function unjudged(selected: readonly { keyword: string; term?: true }[], m: MeasuredMarket): string[] {
  return selected.filter((search) => search.term !== true && m.judged[searchKey(search.keyword)] === undefined).map((search) => search.keyword);
}

/** How many judgements a market keeps: the newest. */
const JUDGED_MAX = 200;

/** The market's judgements with a pass's own added, newest last, bounded. */
export function withJudged(held: Readonly<Record<string, boolean>> | undefined, fresh: Readonly<Record<string, boolean>>): Record<string, boolean> {
  const all = { ...(held ?? {}) };
  for (const [search, on] of Object.entries(fresh)) {
    delete all[searchKey(search)];
    all[searchKey(search)] = on;
  }
  return Object.fromEntries(Object.entries(all).slice(-JUDGED_MAX));
}
