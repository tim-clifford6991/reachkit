// src/lib/market/rivals/candidates.ts — BUILD §6.6, SPEC §6 right-sizing
// (issue 901)
//
// **Which domains a pass sizes, read off the questions it actually
// asked.** §6.6's sizing measured exactly one set — the rivals the
// customer chose (`tracked.ts`) — and the pass's own twelve top tens fed
// it nothing. So a pass that selected twelve right-sized questions banded
// every one of them against domains that never appeared in their SERPs:
// winnability read `undeterminable` for every top-ten domain, and the
// report's rivals were ordered by a band nobody had measured. This module
// is the candidate half of the answer: the domains a pass's own SERPs
// hold, in the order they are worth spending on.
//
// **This module buys nothing and reads no clock.** It counts over SERPs
// already paid for — §6.6's "zero extra cost" — and resolves no import
// into `src/lib/vendors/`, `src/lib/costs/` or `src/lib/llm/`. What it
// returns is a list of domains; `size.ts` is what spends.
//
// Domain normalisation, the platform partition and the own-domain test
// are `./domains`', exactly as `derive.ts` takes them: one implementation
// in the product, not two.
import { RIVAL_DEMAND } from "@/lib/config/constants";
import type { MarketConclusion } from "../infer/types";
import type { MarketSerp } from "../views";
import { isOwnDomain, isPlatformDomain, registrableDomain } from "./domains";

interface Tally {
  /** How many of the pass's top tens hold this domain — once per SERP,
   *  never once per row: the unit §6.6 counts is "appears in this
   *  search". */
  appearances: number;
  /** The best position it holds anywhere in them. */
  bestPosition: number;
}

/**
 * The domains of a pass's own top tens, in the order it should spend on
 * them, at most `max` of them.
 *
 * **The order is the issue's: how often they appear, then how well they
 * rank** — `appearances` descending, `bestPosition` ascending, the domain
 * itself last so that the same SERPs always produce the same list.
 *
 * **The selection walks the SERPs a round at a time, and that is a choice
 * this file makes** (flagged for the owner). Taking the globally
 * best-ranked `max` domains would spend the whole allowance on the
 * handful of large domains that hold the top of every search in a market,
 * and leave the long-tail questions — the ones a cold-start site is
 * actually offered — banded against nothing, which is the defect. So each
 * round gives every question's top ten one candidate, its own best
 * unpicked domain by the order above, and the rounds repeat until `max`
 * is reached or every domain is picked. A market of one repeated top ten
 * is unaffected: the first round picks it and the second finds nothing
 * new.
 *
 * Platforms, the customer's own domain and anything that does not parse
 * are out, exactly as they are out of `deriveRivals`.
 */
export function serpRivalCandidates(a: {
  serps: readonly MarketSerp[];
  ownDomain: string;
  max: number;
}): string[] {
  const tallies = new Map<string, Tally>();
  /** Each SERP's own candidate domains, de-duplicated within it. */
  const perSerp: string[][] = [];

  for (const serp of a.serps) {
    const here: string[] = [];
    for (const row of serp.organic) {
      const domain = registrableDomain(row.domain);
      if (domain === null) continue;
      if (isOwnDomain(domain, a.ownDomain)) continue;
      if (isPlatformDomain(domain)) continue;

      const seenHere = here.includes(domain);
      if (!seenHere) here.push(domain);
      const tally = tallies.get(domain);
      if (tally === undefined) {
        tallies.set(domain, { appearances: 1, bestPosition: row.position });
        continue;
      }
      if (!seenHere) tally.appearances += 1;
      tally.bestPosition = Math.min(tally.bestPosition, row.position);
    }
    if (here.length > 0) perSerp.push(here);
  }

  const worth = (domain: string): Tally => tallies.get(domain) ?? { appearances: 0, bestPosition: Infinity };
  const byWorth = (x: string, y: string): number => {
    const left = worth(x);
    const right = worth(y);
    return (
      right.appearances - left.appearances ||
      left.bestPosition - right.bestPosition ||
      (x < y ? -1 : x > y ? 1 : 0)
    );
  };
  for (const list of perSerp) list.sort(byWorth);

  const picked: string[] = [];
  const taken = new Set<string>();
  while (picked.length < a.max) {
    let progressed = false;
    for (const list of perSerp) {
      if (picked.length >= a.max) break;
      const next = list.find((domain) => !taken.has(domain));
      if (next === undefined) continue;
      taken.add(next);
      picked.push(next);
      progressed = true;
    }
    if (!progressed) break;
  }
  return picked;
}

const letters = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * **Only an on-market candidate is sized** (SPEC §6, owner D64, issue 1301).
 *
 * A top ten holds publishers, aggregators and agencies beside the products
 * of a market, and each sizing is a 2.4¢ read: reachkit.app's re-measure of
 * 2026-10-07 spent 24¢ sizing ten domains that are not in its market. What
 * the pass knows about a domain is what its market holds: the rivals in
 * force, and `demand.brands` — the brand keywords of every candidate a
 * rival conclusion called a product in this market (D50), read at most 30
 * days ago. A publisher, an aggregator and a domain the conclusion called
 * off-market are never among them.
 *
 * So a domain is kept where it is a rival in force, or where one of those
 * brands is its own name — the domain's label, or the label and its ending
 * said apart ("peec ai" for `peec.ai`, "llm pulse" for `llmpulse.ai`) — and
 * the brand is searched (D50's 100 a month) or an AI answer of this pass
 * cited the domain or named the brand. A market that holds neither rivals
 * nor brands keeps none: nothing has called any domain on-market.
 */
export function onMarketCandidates(a: {
  candidates: readonly string[];
  market: Pick<MarketConclusion, "rivals" | "demand"> | null;
  answers: readonly { citedDomains: readonly string[]; excerpt?: string | null }[];
}): string[] {
  if (a.market === null) return [];
  const rivals = new Set(a.market.rivals.map((rival) => registrableDomain(rival.domain) ?? rival.domain));
  const brands = Object.entries(a.market.demand?.brands ?? {}).map(([keyword, volume]) => ({ keyword, volume, spelt: letters(keyword) }));
  const cited = new Set(a.answers.flatMap((answer) => answer.citedDomains.map((domain) => registrableDomain(domain) ?? domain)));
  const said = ` ${a.answers.map((answer) => (answer.excerpt ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")).join(" ")} `;
  return a.candidates.filter((domain) => {
    if (rivals.has(domain)) return true;
    const [label = "", ...ending] = domain.split(".");
    const own = new Set([letters(label), letters(label + ending.join(""))]);
    const mine = brands.filter((brand) => brand.spelt.length > 2 && own.has(brand.spelt));
    if (mine.length === 0) return false;
    return mine.some((brand) => brand.volume >= RIVAL_DEMAND.MIN_VOLUME || said.includes(` ${brand.keyword.toLowerCase()} `)) || cited.has(domain);
  });
}

/**
 * The top-ten domains one pass sizes: its own top tens' domains, in the
 * order they are worth spending on, kept only where the market holds them
 * as on-market, without the ones it already sized, at most `max`. The pass
 * and its replay (`npm run pass`) both ask here.
 */
export function serpDomainsToSize(a: {
  serps: readonly MarketSerp[];
  ownDomain: string;
  market: Pick<MarketConclusion, "rivals" | "demand"> | null;
  answers: readonly { citedDomains: readonly string[]; excerpt?: string | null }[];
  alreadySized: ReadonlySet<string>;
  max: number;
}): { inTopTens: number; domains: string[] } {
  const inTopTens = serpRivalCandidates({ serps: a.serps, ownDomain: a.ownDomain, max: Number.POSITIVE_INFINITY });
  const domains = onMarketCandidates({ candidates: inTopTens, market: a.market, answers: a.answers })
    .filter((domain) => !a.alreadySized.has(domain))
    .slice(0, a.max);
  return { inTopTens: inTopTens.length, domains };
}
