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

/** Returns the price id map sourced from env. */
export function priceMap(): { solo: string; growth: string } {
  return { solo: env.stripePriceSolo, growth: env.stripePriceGrowth };
}
