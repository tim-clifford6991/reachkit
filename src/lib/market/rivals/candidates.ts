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
