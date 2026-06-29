/**
 * Two-lens supply view — a pure, testable derivation of:
 *   Lens A — Traffic sources (6-way channel mix, as 0–1 shares summing to ~1):
 *             organic · paid · referral · social · direct · email
 *   Lens B — Growth activities (3-way relative weights):
 *             content · seo · outreach
 *
 * All outputs are ESTIMATES derived from public SEO signals (DataForSEO ETV,
 * keyword footprint, referring-domain counts, backlink categories, branded
 * search volume). They are NOT measured analytics. The `estimated: true` flag
 * is on the return type so downstream consumers always carry that label.
 *
 * The function is deliberately free of I/O so it can be unit-tested without
 * any mocks. Every field has a sensible default (0 / empty map) so callers
 * never need to guard for undefined.
 */

import type { ReferrerCategory } from "@/lib/scan/referral/classify-referrers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrafficLens {
  sources: {
    /** Share of estimated traffic driven by organic search (SEO). */
    organic: number;
    /** Share driven by paid search (Google Ads / PPC). */
    paid: number;
    /** Share driven by inbound links from external sites. */
    referral: number;
    /** Share driven by social-platform referrers. */
    social: number;
    /** Share driven by direct / branded traffic (branded-search volume proxy). */
    direct: number;
    /** Share driven by newsletter referrers. */
    email: number;
  };
  activities: {
    /** Weight of content production as a growth driver. */
    content: number;
    /** Weight of SEO (keyword footprint + backlink authority). */
    seo: number;
    /** Weight of outreach (earned referrers: media, blog, partner, community). */
    outreach: number;
  };
  /** Always true — these are estimates, not measured analytics. */
  estimated: true;
}

export interface TrafficLensInput {
  /** DataForSEO Labs organic ETV (estimated traffic value). */
  organicEtv: number;
  /** DataForSEO Labs paid ETV (from the same rank-overview response). */
  paidEtv: number;
  /** Number of unique referring domains (Backlinks summary). */
  referringDomains: number;
  /** Monthly search volume for the brand name (Google Ads direct proxy). */
  brandedSearchVolume: number;
  /** Referrer breakdown by category (from classifyReferrers + buildBreakdown). */
  byCategory: Partial<Record<ReferrerCategory, number>>;
  /** Number of top organic pages (SeoPosture.topPages?.length). */
  topPagesCount: number;
  /** Organic keyword count (DataForSEO Labs). */
  organicKeywords: number;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

const l = (v: number) => Math.log1p(Math.max(0, v));

/**
 * Derive the two-lens supply view from SEO signals.
 *
 * Sources (Lens A):
 *   organic   ← log1p(organicEtv)
 *   paid      ← log1p(paidEtv)
 *   referral  ← log1p(referringDomains)
 *   direct    ← log1p(brandedSearchVolume)
 *   social    ← log1p(byCategory.social count)
 *   email     ← log1p(byCategory.newsletter count)
 *   → normalize to shares; if total=0 return direct=1 (unknown domain fallback)
 *
 * Activities (Lens B):
 *   seo      ← log1p(organicKeywords) + log1p(referringDomains)
 *   content  ← log1p(topPagesCount) + log1p(organicEtv)
 *   outreach ← log1p(media + blog + partner + community referrer counts)
 *   → normalize to weights; if total=0 return equal thirds
 */
export function computeTrafficLens(input: TrafficLensInput): TrafficLens {
  const {
    organicEtv,
    paidEtv,
    referringDomains,
    brandedSearchVolume,
    byCategory,
    topPagesCount,
    organicKeywords,
  } = input;

  // --- Lens A: Traffic sources ---
  const srcOrganic  = l(organicEtv);
  const srcPaid     = l(paidEtv);
  const srcReferral = l(referringDomains);
  const srcDirect   = l(brandedSearchVolume);
  const srcSocial   = l(byCategory.social ?? 0);
  const srcEmail    = l(byCategory.newsletter ?? 0);

  const srcTotal = srcOrganic + srcPaid + srcReferral + srcDirect + srcSocial + srcEmail;

  const sources: TrafficLens["sources"] =
    srcTotal === 0
      ? // No signal at all — unknown/new domain, default to direct=1
        { organic: 0, paid: 0, referral: 0, social: 0, direct: 1, email: 0 }
      : {
          organic:  srcOrganic  / srcTotal,
          paid:     srcPaid     / srcTotal,
          referral: srcReferral / srcTotal,
          social:   srcSocial   / srcTotal,
          direct:   srcDirect   / srcTotal,
          email:    srcEmail    / srcTotal,
        };

  // --- Lens B: Growth activities ---
  // SEO = keyword footprint + backlink authority signal
  const actSeo = l(organicKeywords) + l(referringDomains);
  // Content = top-pages count + organic traffic (content-driven traffic)
  const actContent = l(topPagesCount) + l(organicEtv);
  // Outreach = earned referrers: media coverage, blog mentions, partnerships, community
  // (podcast is not a separate ReferrerCategory in classify-referrers.ts)
  const outreachCount =
    (byCategory.media ?? 0) +
    (byCategory.blog ?? 0) +
    (byCategory.partner ?? 0) +
    (byCategory.community ?? 0);
  const actOutreach = l(outreachCount);

  const actTotal = actSeo + actContent + actOutreach;

  const activities: TrafficLens["activities"] =
    actTotal === 0
      ? // No activity signal — return equal thirds as a neutral baseline
        { content: 1 / 3, seo: 1 / 3, outreach: 1 / 3 }
      : {
          content:  actContent  / actTotal,
          seo:      actSeo      / actTotal,
          outreach: actOutreach / actTotal,
        };

  return { sources, activities, estimated: true };
}
