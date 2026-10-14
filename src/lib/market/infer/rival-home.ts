// src/lib/market/infer/rival-home.ts — where a rival is kept (issue 1417),
// apart from the model calls in `./infer` so a stored rival set can be read
// again without loading them (issue 1426).
import { isListingAddress, isOwnDomain, isPlatformDomain, nameLetters, registrableDomain } from "@/lib/market/rivals/domains";
import { evidenceDomains, type MarketEvidence } from "./evidence";

function isListed(domain: string): boolean {
  return isPlatformDomain(domain) || isListingAddress(domain);
}

/**
 * Where a named product is kept (issue 1417): at its own domain, or — named
 * at a store page, a directory entry or a platform — at the site the
 * evidence gives it (`ownSiteOf`), else nowhere (`null`). The conclusion
 * reads it for each candidate, and the re-score (issue 1426) for each rival
 * already stored.
 */
export function rivalHome(rival: { domain: string; name: string }, evidence: MarketEvidence): string | null {
  return isListed(rival.domain) ? ownSiteOf(rival.name, evidence) : registrableDomain(rival.domain);
}

/**
 * A product's own site, where what this pass read gives one (issue 1417):
 * the address an answer links its name to, else a domain the answers cite
 * or the top tens hold whose name is its name. The one given most often,
 * the first given on a tie; never a listing, a platform or the site itself.
 * `null` where nothing read gives one.
 */
export function ownSiteOf(name: string, evidence: MarketEvidence): string | null {
  const wanted = nameLetters(name);
  if (wanted.length < 3) return null;
  const tally = new Map<string, number>();
  const count = (hostOrUrl: string): void => {
    const domain = registrableDomain(hostOrUrl);
    if (domain === null || isPlatformDomain(hostOrUrl) || isListingAddress(hostOrUrl) || isOwnDomain(domain, evidence.domain)) return;
    tally.set(domain, (tally.get(domain) ?? 0) + 1);
  };
  for (const answer of evidence.answers) {
    for (const [, text, url] of (answer.excerpt ?? "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
      if (text !== undefined && url !== undefined && nameLetters(text) === wanted) count(url);
    }
  }
  if (tally.size === 0) {
    for (const domain of evidenceDomains(evidence)) if (nameLetters(domain.split(".")[0] ?? "") === wanted) count(domain);
  }
  let best: string | null = null;
  for (const [domain, times] of tally) if (best === null || times > (tally.get(best) ?? 0)) best = domain;
  return best;
}
