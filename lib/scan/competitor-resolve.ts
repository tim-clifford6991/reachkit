/**
 * Competitor name → domain resolution (launch-readiness A4).
 *
 * LLM-extracted competitors are persisted name-only (`competitor_store_url=""`,
 * source `llm_extracted`), which made the onboarding picker's `seedFromScan` drop
 * every one of them (it keys by host) — so a scan that found 5 rivals surfaced 0
 * candidates and the picker fell back to live discovery (1 result). This resolves
 * a product name to its official domain via Tavily, guarded against the classic
 * brand-ambiguity trap (a different product sharing the name): a result only
 * counts when the name is clearly reflected in the domain or title, and never
 * when it's an aggregator/listicle host.
 *
 * `pickDomainForName` is PURE (network-free) and unit-tested; `resolveCompetitorDomain`
 * is the thin Tavily wrapper (degrades to null on any failure — never throws).
 */

import { normalizeHost } from "@/lib/scan/referral/classify";
import { isAggregatorHost } from "@/lib/scan/competitor-filter";
import { tavilySearch, type TavilyResult } from "@/lib/scan/adapters/tavily";

/** Alphanumeric lowercase slug — "Acquire.com" → "acquirecom", "ShowMRR" → "showmrr". */
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Second-level label of a host — "app.acquire.com" → "acquire". */
function domainLabel(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return slug(host);
  // take the label before the public suffix (naive: second-to-last part)
  return slug(parts[parts.length - 2] ?? "");
}

/**
 * Choose the official domain for `name` from search results, or null when no
 * result unambiguously matches. CONSERVATIVE by design — a wrong domain poisons
 * the market cohort, so we only accept a clear brand match and otherwise leave
 * the competitor name-only (null):
 *  - skip aggregator/listicle hosts (g2, capterra, producthunt, …);
 *  - accept a domain whose label EQUALS the name slug ("showmrr" = showmrr.com);
 *  - accept when the name is the domain label plus a suffix like a TLD word
 *    ("acquirecom" starts with "acquire" → acquire.com);
 *  - accept a domain label that is the name slug plus ≤2 trailing chars
 *    (near-exact, e.g. pluralisation), never a longer brand that merely starts
 *    with the name ("bloom" ≠ "bloomandwild").
 *  - else null.
 *
 * Deliberately no fuzzy title matching: "Bloom" appears in "Bloom & Wild" and
 * "Bloom Energy" — matching on that would resolve to the wrong company.
 */
export function pickDomainForName(name: string, results: TavilyResult[]): string | null {
  const nameSlug = slug(name);
  if (!nameSlug) return null;

  for (const res of results) {
    const host = normalizeHost(res.url);
    if (!host || isAggregatorHost(host)) continue;
    const label = domainLabel(host);
    if (!label) continue;
    const exact = label === nameSlug;
    const nameHasDomain = label.length >= 4 && nameSlug.startsWith(label); // "acquirecom" ⊃ "acquire"
    const domainNearName = nameSlug.length >= 4 && label.startsWith(nameSlug) && label.length - nameSlug.length <= 2;
    if (exact || nameHasDomain || domainNearName) return host;
  }
  return null;
}

/**
 * Resolve one competitor name to its domain via Tavily. Returns null in fixtures
 * mode, on any error, or when no result unambiguously matches. `category`
 * disambiguates same-name products across categories.
 */
export async function resolveCompetitorDomain(name: string, category?: string): Promise<string | null> {
  const q = category ? `${name} ${category} official website` : `${name} official website`;
  try {
    const results = await tavilySearch(q, { maxResults: 5 });
    return pickDomainForName(name, results);
  } catch {
    return null;
  }
}
