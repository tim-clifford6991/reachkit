/**
 * Reverse-referral discovery (validation spine).
 *
 * Mines the inbound backlink graph of a subject + its competitors to find the
 * third-party platforms feeding rivals that the subject is absent from — the
 * "secret channels" insight. Types only; logic lives in classify/intersect/discover.
 */

/** The kind of distribution surface a referring page represents. */
export type ChannelType =
  | "community" // subreddit, forum, HN, Discord/Slack directory
  | "directory" // listing/aggregator that is a real funnel (not noise)
  | "marketplace" // G2, Capterra, AppSumo, Product Hunt category pages
  | "newsletter" // beehiiv/Substack issue, mailing-list archive
  | "partner" // integration page, "works with X", partner directory
  | "review" // independent review / comparison site
  | "listicle" // "best X tools" roundup
  | "podcast" // show notes / episode page
  | "resource" // docs, wikis, curated resource pages
  | "other";

/** One referring page pointing at a target domain (raw from a backlink source). */
export interface Referrer {
  referringUrl: string; // the page that links out
  referringHost: string; // normalized host of referringUrl
  targetUrl: string; // the competitor/subject page being linked to
  anchorText: string;
}

/** A referrer after classification + traffic weighting. */
export interface ClassifiedReferrer extends Referrer {
  channel: ChannelType;
  /** Estimated monthly organic traffic (ETV) of the referring host. null if unknown. */
  refererTraffic: number | null;
}

/** A discovered opportunity: a platform feeding ≥N competitors, ranked. */
export interface ReferralOpportunity {
  host: string; // the platform host
  exampleUrl: string; // a representative referring page
  channel: ChannelType;
  competitorsUsing: number; // how many of the cohort it refers
  competitorHosts: string[]; // which competitors (evidence)
  reachWeight: number; // traffic-weighted score (sort key)
  selfPresent: boolean; // does it already refer the subject?
}

/** The assembled section. */
export interface CompetitorReferralChannels {
  opportunities: ReferralOpportunity[]; // ranked; subject is absent
  shared: ReferralOpportunity[]; // parity surfaces (subject already present)
  measured: boolean; // false when no backlink data was available at all
}
