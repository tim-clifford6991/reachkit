/**
 * Demand discovery (M3) — shared types.
 *
 * The "demand lens": find people DESCRIBING the problem a product solves (in
 * their own words), not just mentions of the brand. Used both for paid users'
 * reports and for ReachKit's own dogfooding lead-radar.
 */

/** What a product is + the problem it solves — the input to demand discovery. */
export interface ProductBrief {
  brand: string;
  /** One sentence: the problem the product solves, in plain terms. */
  problem: string;
  /** Who has the problem (the buyer). */
  audience: string;
  /** What the product offers / its value prop. */
  valueProp: string;
}

/** One search hit that may contain a person expressing the problem. */
export interface DemandHit {
  title: string;
  url: string;
  snippet: string;
  /** "r/xyz" when the hit is a Reddit thread, else null. */
  subreddit: string | null;
  /** The pain query that surfaced this hit. */
  query: string;
  /** Publish date (ISO) when the SERP exposes one — drives recency weighting. */
  publishedAt: string | null;
}

/** A hit after intent classification. */
export interface ClassifiedHit extends DemandHit {
  /** True when this is a real person expressing the problem (a potential buyer). */
  isBuyerPain: boolean;
  /** Buyer-intent strength 0..1. */
  intent: number;
}

/** A clustered "demand pocket": a community/surface where buyers are asking. */
export interface DemandPocket {
  /** Display surface, e.g. "r/SaaS" or a domain. */
  surface: string;
  subreddit: string | null;
  count: number;
  /** Sum of buyer-intent across the pocket's hits. */
  intentSum: number;
  /** Ranking score (recency-weighted intent density × reach). */
  score: number;
  /** A few representative threads to engage (freshest, highest-intent first). */
  topThreads: Array<{ title: string; url: string; intent: number; publishedAt: string | null }>;
}

export interface DemandResult {
  painQueries: string[];
  pockets: DemandPocket[];
  totalHits: number;
  buyerPainHits: number;
}
