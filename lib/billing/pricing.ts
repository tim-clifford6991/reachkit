/**
 * The single source of truth for ReachKit's paid-tier prices (WS5).
 *
 * Prices used to be duplicated across the pricing page, the reusable tier card,
 * the landing/compare copy, and the JSON-LD — a real drift risk. This module
 * owns the numbers + currency + formatting; every surface reads from here.
 *
 * Currency is EUR (the product's market). The amounts are the DISPLAY prices;
 * the actual charge is whatever the wired Stripe EUR Price object says
 * (`lib/config/env.ts` STRIPE_PRICE_* → `priceIdFor`), so keep these in sync
 * with the Stripe prices. Annual = 2 months free = 10× the monthly.
 */

export const CURRENCY = { code: "EUR", symbol: "€" } as const;

export interface TierPrice {
  plan: "solo" | "growth";
  name: string;
  /** Monthly price, whole EUR. */
  monthly: number;
  /** Annual price, whole EUR (= 10× monthly — two months free). */
  annual: number;
}

export const TIERS: readonly TierPrice[] = [
  { plan: "solo", name: "Solo", monthly: 59, annual: 590 },
  { plan: "growth", name: "Growth", monthly: 129, annual: 1290 },
];

/** Format a whole-EUR amount for display: 59 → "€59", 1290 → "€1,290". */
export function fmtPrice(amount: number): string {
  return `${CURRENCY.symbol}${amount.toLocaleString("en-US")}`;
}

/** The effective monthly cost of an annual plan, rounded: 590 → 49, 1290 → 108. */
export function annualPerMonth(annual: number): number {
  return Math.round(annual / 12);
}

/** Look up a tier by plan key. Throws on an unknown plan (callers pass a typed key). */
export function tierByPlan(plan: "solo" | "growth"): TierPrice {
  const tier = TIERS.find((t) => t.plan === plan);
  if (!tier) throw new Error(`unknown plan: ${plan}`);
  return tier;
}
