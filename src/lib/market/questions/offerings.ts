// src/lib/market/questions/offerings.ts — a business that sells several
// lines is measured across all of them (issue 1454).
//
// The profile names 1–4 offerings, each with its own category and its share
// of the site. Before this, one category stood for the whole business, so a
// CRM that also sells marketing and service software, or a café that serves
// breakfast as well as coffee, was measured on one slice: its searches, its
// rivals and its pages all followed that slice.
//
// Pure, like `select.ts` and `widen.ts`: no context, no clock, no I/O.
import type { Language } from "@/lib/locale/locales";
import { OFFERINGS } from "@/lib/config/constants";
import type { Offering, Profile } from "./profile-types";
import { contentTokens, type SelectedSearch } from "./select";

/** The profile's offerings; a profile read before they were asked sells
 *  one line, its category, and one with no category sells nothing named. */
export function offeringsOf(profile: Pick<Profile, "category" | "offerings">): readonly Offering[] {
  if (profile.offerings !== undefined && profile.offerings.length > 0) return profile.offerings;
  const category = profile.category.trim();
  return category === "" ? [] : [{ name: category, category, weight: 1 }];
}

/** The offerings after the first that are bought a seed of their own
 *  before the pass knows whether it is short: those with at least
 *  `OFFERINGS.seedShare` of the site whose category shares no word but a
 *  generic one with a line already seeded. A line that does is the same
 *  line worded again, and the earlier seed's suggestions already hold its
 *  searches. Their categories, in the profile's order. */
export function offeringSeeds(profile: Pick<Profile, "category" | "offerings" | "language">): string[] {
  const language = profile.language ?? "en";
  const generic = new Set(OFFERINGS.genericWords.flatMap((word) => contentTokens(word, language)));
  const words = (o: Offering): string[] => contentTokens(o.category, language).filter((token) => !generic.has(token));
  const [lead, ...rest] = offeringsOf(profile);
  if (lead === undefined) return [];
  const seeded = new Set(words(lead));
  const seeds: string[] = [];
  for (const o of rest) {
    if (o.weight < OFFERINGS.seedShare) continue;
    const own = words(o);
    if (own.some((token) => seeded.has(token))) continue;
    own.forEach((token) => seeded.add(token));
    seeds.push(o.category);
  }
  return seeds;
}

/** Which offering a search is about: the one whose category and name share
 *  the most words with it, the first on a tie. `null` where it shares a word
 *  with none (a search about the market as a whole). */
export function offeringOf(keyword: string, offerings: readonly Offering[], language: Language = "en"): number | null {
  const tokens = new Set(contentTokens(keyword, language));
  let best: number | null = null;
  let bestShared = 0;
  offerings.forEach((offering, index) => {
    const own = new Set(contentTokens(`${offering.category} ${offering.name}`, language));
    let shared = 0;
    for (const token of own) if (tokens.has(token)) shared++;
    if (shared > bestShared) {
      best = index;
      bestShared = shared;
    }
  });
  return best;
}

/**
 * At most `limit` of `candidates`, spread across the offerings in proportion
 * to their weight (largest remainder), each offering's share filled with its
 * own searches in the candidates' order. A share its searches cannot fill,
 * and every place left, goes to the remaining candidates in their order, so
 * a business with one offering, or with no search for one of its lines,
 * gets the same searches it got before. The result is in the candidates'
 * order and ranked again from 1.
 */
export function spreadAcrossOfferings(
  candidates: readonly SelectedSearch[],
  offerings: readonly Offering[],
  limit: number,
  language: Language = "en"
): SelectedSearch[] {
  if (offerings.length < 2 || candidates.length <= limit) return rerank(candidates.slice(0, limit));
  const about = candidates.map((c) => offeringOf(c.keyword, offerings, language));
  const shares = sharesOf(offerings, limit);
  const picked = new Set<number>();
  offerings.forEach((_, o) => {
    let left = shares[o]!;
    about.forEach((which, i) => {
      if (left > 0 && which === o) {
        picked.add(i);
        left--;
      }
    });
  });
  for (let i = 0; i < candidates.length && picked.size < limit; i++) picked.add(i);
  return rerank(candidates.filter((_, i) => picked.has(i)));
}

/** `limit` places shared by weight, largest remainder first; every offering
 *  with any weight gets at least one place while places last. */
function sharesOf(offerings: readonly Offering[], limit: number): number[] {
  const total = offerings.reduce((sum, o) => sum + Math.max(0, o.weight), 0) || 1;
  const exact = offerings.map((o) => (Math.max(0, o.weight) / total) * limit);
  const shares = exact.map((x) => Math.floor(x));
  let left = limit - shares.reduce((sum, x) => sum + x, 0);
  for (let o = 0; o < shares.length && left > 0; o++) {
    if (shares[o] === 0 && exact[o]! > 0) {
      shares[o] = 1;
      left--;
    }
  }
  const order = exact.map((x, o) => ({ o, rest: x - Math.floor(x) })).sort((x, y) => y.rest - x.rest);
  for (const { o } of order) {
    if (left <= 0) break;
    shares[o]!++;
    left--;
  }
  return shares;
}

function rerank(searches: readonly SelectedSearch[]): SelectedSearch[] {
  return searches.map((search, i) => (search.rank === i + 1 ? search : { ...search, rank: i + 1 }));
}
