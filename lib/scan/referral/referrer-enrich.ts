/**
 * Enriches quality referrers with "platform reach" (the referring host's own
 * organic ETV — how big the venue is, NOT measured click-through to the rival)
 * and a borderline-relevance flag. Reach comes from fetchTrafficForHosts; a host
 * missing from the map keeps etv = null (we never invent a number).
 */
import type { QualityReferrer } from "@/lib/scan/referral/funnel";

/** A referrer with near-zero reach AND weak authority is marginal → "low". */
export const REACH_FLOOR = 100;      // monthly organic visits
export const AUTHORITY_FLOOR = 150;  // domain_from_rank (0–1000)

export function enrichReferrers(
  refs: QualityReferrer[],
  reach: Map<string, number>,
): QualityReferrer[] {
  return refs.map((r) => {
    const etv = reach.has(r.host) ? (reach.get(r.host) ?? 0) : null;
    const weakReach = (etv ?? 0) < REACH_FLOOR;
    const weakAuthority = (r.authority ?? 0) < AUTHORITY_FLOOR;
    const relevance: QualityReferrer["relevance"] = weakReach && weakAuthority ? "low" : "core";
    return { ...r, etv, relevance };
  });
}
