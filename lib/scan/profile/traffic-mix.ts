/**
 * Derived traffic-source mix (ChannelIntel Phase 2).
 *
 * DataForSEO does NOT return a SimilarWeb-style channel split, so this is an
 * ESTIMATE derived from signals we already have: organic from the keyword
 * footprint, referral from referring domains, social from community mentions,
 * and direct as a reserved residual. It is intentionally rough — always render
 * it with the `estimated` flag surfaced. PURE; no I/O.
 */

import type { DistributionProfile } from "./types";

export interface TrafficMix {
  organic: number;
  referral: number;
  social: number;
  direct: number;
  /** Always true — this is a heuristic estimate, not measured analytics. */
  estimated: true;
}

/** Share of total community mentions across a profile's surfaces. */
function communityMentions(p: DistributionProfile): number {
  return p.communities.reduce((sum, c) => sum + (c.mentions ?? 0), 0);
}

// Reserved floor for direct/branded traffic — most products get a chunk of
// type-in / branded-search visits that none of our signals capture.
const DIRECT_FLOOR = 0.2;

/**
 * Estimate a channel split for a profile. Returns null when there's nothing to
 * go on (no SEO posture AND no community mentions) — better than a fake 100%.
 */
export function estimateTrafficMix(p: DistributionProfile): TrafficMix | null {
  const mentions = communityMentions(p);
  const hasSeo = p.seo != null;
  if (!hasSeo && mentions === 0) return null;

  // log1p compresses wildly different magnitudes (keywords in the thousands,
  // referring domains in the hundreds, mentions in the tens) onto a comparable scale.
  const organicSig = Math.log1p(p.seo?.organicKeywords ?? 0);
  const referralSig = Math.log1p(p.seo?.referringDomains ?? 0);
  const socialSig = Math.log1p(mentions);
  const sig = organicSig + referralSig + socialSig;

  // No positive signal anywhere (e.g. a domain with seo:{0,0} and no mentions):
  // attribute everything to direct.
  if (sig === 0) return { organic: 0, referral: 0, social: 0, direct: 1, estimated: true };

  const share = 1 - DIRECT_FLOOR;
  return {
    organic: (organicSig / sig) * share,
    referral: (referralSig / sig) * share,
    social: (socialSig / sig) * share,
    direct: DIRECT_FLOOR,
    estimated: true,
  };
}
