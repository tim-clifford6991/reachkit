/**
 * Deep domain profiling (M2) — shared types.
 *
 * A DistributionProfile captures where a company publishes (content channels +
 * cadence), how fresh that activity is (recency is a first-class signal), and
 * its SEO standing — for the user's own domain AND each competitor, to power the
 * gap analysis + distribution plan.
 */

/** Publish cadence over an observed set of dates — recency-first. */
export interface Cadence {
  totalPosts: number;
  postsLast30: number;
  postsLast90: number;
  /** ISO date of the most recent post, or null. */
  lastPublishedAt: string | null;
  /** Posts per month across the observed window. */
  postsPerMonth: number;
  /** Published anything in the last 90 days. */
  active: boolean;
}

export type ChannelKind =
  | "blog"
  | "youtube"
  | "newsletter"
  | "devto"
  | "medium"
  | "github"
  | "podcast";

/** A distribution channel the domain publishes to. */
export interface ContentChannel {
  kind: ChannelKind;
  label: string;
  /** Handle / feed / channel URL when known. */
  url: string | null;
  /** Cadence when measurable (blog/YouTube/newsletter via feeds). */
  cadence?: Cadence;
}

/** SEO standing (from DataForSEO Labs). */
export interface SeoPosture {
  organicKeywords: number;
  /** Estimated traffic value (summed ETV). */
  etv: number;
  /** Domain authority proxy (DataForSEO backlinks `rank`). null when the
   *  Backlinks API returned no data (e.g. not subscribed) — distinct from 0. */
  authority: number | null;
  referringDomains: number | null;
}

export interface DistributionProfile {
  domain: string;
  channels: ContentChannel[];
  seo: SeoPosture | null;
  /** ISO timestamp this profile was built (cache key). */
  crawledAt: string;
}
