// src/lib/market/infer/presence.ts — rivals are chosen from who the pass
// saw (SPEC §6, 2026-10-09, issue 1365).
//
// D50 puts the candidates buyers search for first, so a site's rivals were
// the brands its market is known for. reachkit.app tracked Profound, Peec
// AI, Otterly, Omniscient and Brandi, and none of the five held a first-page
// place on any of its ten measured searches: the Rivals tab drew 0 of 10 for
// every one. So each candidate also carries what the pass's own evidence
// shows of it, and that is weighed before its brand.
//
// Pure: no I/O. The evidence is what the pass already bought.
import { RIVAL_PRESENCE } from "@/lib/config/constants";
import { isOwnDomain } from "@/lib/market/rivals/domains";
import { direct, searched } from "./demand";
import type { MarketEvidence } from "./evidence";
import { RIVALS_MAX, type RivalConclusion } from "./types";

/** What one pass's evidence shows of a candidate. */
export interface Seen {
  /** Measured searches whose first page holds one of its pages. */
  firstPage: number;
  /** AI answers that cite its domain or say its name. */
  named: number;
}

export type SeenByDomain = ReadonlyMap<string, Seen>;

/** Whether an answer's words say a product's name: as the conclusion wrote
 *  it, whole, in its own capitals — "Profound" is the product and "a
 *  profound change" is not. A name under three letters is never read. */
function says(text: string, name: string): boolean {
  const wanted = name.trim();
  if (wanted.length < 3) return false;
  let from = text.indexOf(wanted);
  while (from !== -1) {
    const before = text[from - 1] ?? " ";
    const after = text[from + wanted.length] ?? " ";
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
    from = text.indexOf(wanted, from + 1);
  }
  return false;
}

/** What the evidence shows of one candidate. The evidence is read whole,
 *  not as one prompt carries it. */
export function seenIn(evidence: MarketEvidence, rival: Pick<RivalConclusion, "domain" | "name">): Seen {
  let firstPage = 0;
  for (const row of evidence.topTens) if (isOwnDomain(row.domain, rival.domain)) firstPage += row.appearances;
  let named = 0;
  for (const answer of evidence.answers) {
    const cited = answer.citedDomains.some((domain) => isOwnDomain(domain, rival.domain));
    if (cited || says(answer.excerpt ?? "", rival.name)) named += 1;
  }
  return { firstPage, named };
}

export function seenByDomain(evidence: MarketEvidence, rivals: readonly RivalConclusion[]): Map<string, Seen> {
  return new Map(rivals.map((rival) => [rival.domain, seenIn(evidence, rival)]));
}

/**
 * The rivals a pass wants, from every candidate it concluded: at most
 * `max`, in the order they are chosen.
 *
 * - First the products that hold the most first-page places on the measured
 *   searches, up to `RIVAL_PRESENCE.FIRST_PAGE_PLACES` of them: who wins
 *   those searches is a rival whatever its brand's volume. Only one that
 *   does the business's own job (issue 1314) takes such a place.
 * - Then D50's order — searched and direct, searched and partial, the rest —
 *   with a candidate the pass saw (a first-page place, or an AI answer that
 *   names it) before one it saw nowhere, and a standing rival before a new
 *   one of the same standing.
 *
 * `fresh` is in D50's order (`byDemand`). Without `seen` — a caller that
 * read no evidence — the order is D50's alone.
 */
export function chooseRivals(a: {
  fresh: readonly RivalConclusion[];
  seen?: SeenByDomain;
  standing?: readonly string[];
  max?: number;
}): RivalConclusion[] {
  const max = a.max ?? RIVALS_MAX;
  const seenOf = (r: RivalConclusion): Seen | undefined => a.seen?.get(r.domain);
  const present = (r: RivalConclusion): boolean => {
    const seen = seenOf(r);
    return a.seen === undefined || (seen !== undefined && seen.firstPage + seen.named > 0);
  };
  const demand = (r: RivalConclusion): number => (!searched(r.volume) ? 2 : direct(r) ? 0 : 1);
  const standing = (r: RivalConclusion): boolean => a.standing?.includes(r.domain) === true;

  const ranked = a.fresh
    .map((rival, order) => ({ rival, order }))
    .sort(
      (x, y) =>
        Number(!present(x.rival)) - Number(!present(y.rival)) ||
        demand(x.rival) - demand(y.rival) ||
        Number(!standing(x.rival)) - Number(!standing(y.rival)) ||
        x.order - y.order
    )
    .map((entry) => entry.rival);

  const places = (r: RivalConclusion): number => seenOf(r)?.firstPage ?? 0;
  const winners = ranked
    .map((rival, order) => ({ rival, order }))
    .filter((entry) => places(entry.rival) > 0 && direct(entry.rival))
    .sort((x, y) => places(y.rival) - places(x.rival) || x.order - y.order)
    .slice(0, RIVAL_PRESENCE.FIRST_PAGE_PLACES)
    .map((entry) => entry.rival);

  return [...winners, ...ranked.filter((rival) => !winners.includes(rival))].slice(0, max);
}
