import Stripe from "stripe";
import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";

/** Throws if Stripe is not configured and fixtures are not enabled. */
export function assertStripeConfigured(): void {
  if (env.stripeSecretKey === "" && !fixturesEnabled()) {
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
 * Resolve the Stripe price id for a (plan, interval). Falls back to the monthly
 * price when an annual price id isn't configured, so the annual toggle degrades
 * gracefully rather than 500ing checkout.
 */
export function priceIdFor(
  plan: "solo" | "growth",
  interval: BillingInterval,
  prices: PriceMap = priceMap(),
): string {
  if (interval === "year") {
    const annual = plan === "growth" ? prices.growthAnnual : prices.soloAnnual;
    if (annual.length > 0) return annual;
  }
  return plan === "growth" ? prices.growth : prices.solo;
}
