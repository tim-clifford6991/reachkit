export type Tier = "free" | "solo" | "growth";

export interface TierLimit {
  apps: number;                          // max apps the tier may track
  refreshCadence: "none" | "weekly";     // weekly delta refresh eligibility
  draftQuota: number;                    // max action drafts per refresh
  rankDepth: number;                     // keyword rank-tracking depth
}

export const TIER_LIMITS: Record<Tier, TierLimit> = {
  free:   { apps: 1, refreshCadence: "none",   draftQuota: 0,   rankDepth: 0  },
  solo:   { apps: 1, refreshCadence: "weekly", draftQuota: 20,  rankDepth: 20 },
  growth: { apps: 3, refreshCadence: "weekly", draftQuota: 100, rankDepth: 50 },
};

export function isPaid(tier: Tier): boolean { return tier === "solo" || tier === "growth"; }

export function isTier(v: string): v is Tier { return v === "free" || v === "solo" || v === "growth"; }

/** Map a Stripe price id → Tier. priceMap comes from env at the call site (kept out of this
 *  pure module so it stays trivially testable). Unknown/empty price ids → "free". */
export function tierForPriceId(priceId: string, priceMap: { solo: string; growth: string }): Tier {
  if (priceId.length > 0 && priceId === priceMap.growth) return "growth";
  if (priceId.length > 0 && priceId === priceMap.solo) return "solo";
  return "free";
}
