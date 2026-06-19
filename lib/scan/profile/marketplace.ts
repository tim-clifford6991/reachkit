/**
 * Launch & marketplace presence (ChannelIntel Phase 3).
 *
 * Where a brand shows up across launch platforms + software directories
 * (Product Hunt, AppSumo, BetaList, G2, Capterra, AlternativeTo). One
 * domain-restricted Tavily search per brand (include_domains spans every
 * marketplace), then buckets the hits by host — so it's a single call per
 * domain, full/paid pass only. Fixtures/failure → [].
 */

import { tavilySearch } from "@/lib/scan/adapters/tavily";

export type MarketplaceSource =
  | "product_hunt"
  | "appsumo"
  | "betalist"
  | "g2"
  | "capterra"
  | "alternativeto";

export interface MarketplacePresence {
  source: MarketplaceSource;
  present: boolean;
  /** A representative listing URL when found. */
  url: string | null;
}

const MARKETPLACE_DOMAINS: Record<MarketplaceSource, string> = {
  product_hunt: "producthunt.com",
  appsumo: "appsumo.com",
  betalist: "betalist.com",
  g2: "g2.com",
  capterra: "capterra.com",
  alternativeto: "alternativeto.net",
};

const ALL_SOURCES = Object.keys(MARKETPLACE_DOMAINS) as MarketplaceSource[];

/** Pure: bucket Tavily result URLs into per-marketplace presence rows. */
export function bucketMarketplace(urls: string[]): MarketplacePresence[] {
  return ALL_SOURCES.map((source) => {
    const domain = MARKETPLACE_DOMAINS[source];
    const hit = urls.find((u) => u.toLowerCase().includes(domain));
    return { source, present: !!hit, url: hit ?? null };
  });
}

/**
 * Gather marketplace presence for a brand. One Tavily search restricted to the
 * marketplace domains. Returns only the marketplaces actually found (present),
 * or [] when nothing/fixtures.
 */
export async function gatherMarketplacePresence(brand: string): Promise<MarketplacePresence[]> {
  if (!brand) return [];
  const results = await tavilySearch(brand, {
    maxResults: 10,
    includeDomains: Object.values(MARKETPLACE_DOMAINS),
  });
  return bucketMarketplace(results.map((r) => r.url)).filter((m) => m.present);
}
