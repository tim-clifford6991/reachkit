import Stripe from "stripe";
import { env } from "@/lib/config/env";
import { fixtures } from "@/lib/scan/fixture-seam";

/** Throws if Stripe is not configured and fixtures are not enabled. */
export function assertStripeConfigured(): void {
  if (env.stripeSecretKey === "" && !fixtures()) {
    throw new Error(
      "Stripe is not configured: STRIPE_SECRET_KEY is required in non-fixtures mode.",
    );
  }
}

/** Returns a Stripe client. Call only after assertStripeConfigured() on the live path. */
export function stripeClient(): Stripe {
  return new Stripe(env.stripeSecretKey, {
    apiVersion: "2026-05-27.dahlia",
  });
}

export type BillingInterval = "month" | "year";

export interface PriceMap {
  solo: string;
  growth: string;
  soloAnnual: string;
  growthAnnual: string;
}

/** Returns the price id map sourced from env (monthly + annual for each tier). */
export function priceMap(): PriceMap {
  return {
    solo: env.stripePriceSolo,
    growth: env.stripePriceGrowth,
    soloAnnual: env.stripePriceSoloAnnual,
    growthAnnual: env.stripePriceGrowthAnnual,
  };
}

/**
 * Resolve the Stripe price id for a (plan, interval).
 *
 * Annual selection with an unconfigured annual price id is a HARD ERROR, never a
 * silent fall-back to the monthly price: the checkout still stamps
 * `metadata.interval:"year"`, so a silent downgrade would record "annual" while
 * charging monthly — an honesty bug on the money path (the public
 * `/api/billing/checkout/anonymous` accepts `interval:"year"` regardless of UI).
 * Better a loud 500 that surfaces the misconfig than a mislabelled charge.
 */
export function priceIdFor(
  plan: "solo" | "growth",
  interval: BillingInterval,
  prices: PriceMap = priceMap(),
): string {
  if (interval === "year") {
    const annual = plan === "growth" ? prices.growthAnnual : prices.soloAnnual;
    if (annual.length === 0) {
      throw new Error(
        `annual price not configured for plan "${plan}" (set STRIPE_PRICE_${plan.toUpperCase()}_ANNUAL) — refusing to bill monthly under an annual label`,
      );
    }
    return annual;
  }
  return plan === "growth" ? prices.growth : prices.solo;
}
