import { serverDb } from "@/lib/db/client";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { env } from "@/lib/config/env";
import { assertStripeConfigured, stripeClient } from "@/lib/billing/stripe";

/**
 * Thrown when a user has no Stripe customer to manage (e.g. a subscription that
 * was provisioned outside Stripe, or checkout never completed). A clear,
 * user-facing condition — not an unexpected server error.
 */
export class NoBillingAccountError extends Error {
  constructor() {
    super("No Stripe billing account is linked to this subscription yet — it was set up outside checkout, so there's nothing to manage in the portal.");
    this.name = "NoBillingAccountError";
  }
}

/**
 * Create a Stripe customer-portal session for the given user.
 *
 * Fixture path → a demo URL (no Stripe). Live path → load the user's
 * stripe_customer_id (must exist — without it there is no subscription to
 * manage) and open a billing-portal session that returns to /app/billing.
 */
export async function createPortalSession(userId: string): Promise<{ url: string }> {
  // ---------------------------------------------------------------------------
  // Fixture path — no Stripe; return the demo billing URL.
  // ---------------------------------------------------------------------------
  if (fixturesEnabled()) {
    return { url: `${env.appUrl}/app/billing?portal=demo` };
  }

  // ---------------------------------------------------------------------------
  // Live Stripe path.
  // ---------------------------------------------------------------------------
  assertStripeConfigured();

  const { data: user, error } = await serverDb()
    .from("users")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`portal: failed to load user (id=${userId}) — ${error.message}`);
  }

  const customer = user?.stripe_customer_id;
  if (!customer) {
    throw new NoBillingAccountError();
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer,
    return_url: `${env.appUrl}/app/billing`,
  });

  return { url: session.url };
}
