import { serverDb } from "@/lib/db/client";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { env } from "@/lib/config/env";
import { provisionCheckoutUser } from "@/lib/billing/provision";
import {
  assertStripeConfigured,
  stripeClient,
  priceIdFor,
  type BillingInterval,
} from "@/lib/billing/stripe";

/**
 * Anonymous, payment-first checkout (the public funnel). No logged-in user — the
 * account is created from the Stripe-collected email AFTER payment (by the
 * webhook in live mode, inline here in fixtures mode).
 *
 * `scanId` is optional:
 *   - Path A (scan-first): the scanned app is linked to the new user.
 *   - Path B (trial-direct, e.g. pricing table): no scan; the user runs their
 *     first scan from inside the dashboard.
 */
export async function createAnonymousCheckout({
  scanId,
  plan,
  interval = "month",
}: {
  scanId?: string;
  plan: "solo" | "growth";
  interval?: BillingInterval;
}): Promise<{ url: string }> {
  const cancelUrl = scanId
    ? `${env.appUrl}/scan/${scanId}/results`
    : `${env.appUrl}/#pricing`;

  // Fixtures path — no Stripe, no webhook. Provision the account inline so the
  // funnel is demoable keyless, then drop the user at /welcome.
  if (fixturesEnabled()) {
    const email = `fixture+${scanId ?? "direct"}@reachkit.dev`;
    await provisionCheckoutUser({
      email,
      scanId,
      entitlement: { tier: plan, status: "active" },
      sendMagicLink: true,
    });
    return { url: `${env.appUrl}/welcome?fixture=1` };
  }

  // Live Stripe path. Subscription mode always creates a customer and collects
  // the email; the scanId rides in metadata for the webhook to consume.
  assertStripeConfigured();
  const stripe = stripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    metadata: { plan, interval, ...(scanId ? { scanId } : {}) },
    client_reference_id: scanId,
    // 7-day free trial: subscription created in `trialing` (card now, charge at
    // trial end). entitlementsFor() treats "trialing" as active.
    subscription_data: { trial_period_days: 7 },
    success_url: `${env.appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  });

  return { url: session.url ?? cancelUrl };
}

export async function createCheckout({
  userId,
  plan,
  interval = "month",
}: {
  userId: string;
  plan: "solo" | "growth";
  interval?: BillingInterval;
}): Promise<{ url: string }> {
  // ---------------------------------------------------------------------------
  // Fixture path — no Stripe; directly upgrade the user row for demo/test.
  // ---------------------------------------------------------------------------
  if (fixturesEnabled()) {
    const { error } = await serverDb()
      .from("users")
      .update({ tier: plan, subscription_status: "active" })
      .eq("id", userId);

    if (error) {
      throw new Error(`fixture checkout: failed to update user tier — ${error.message}`);
    }

    return { url: `${env.appUrl}/app?billing=demo` };
  }

  // ---------------------------------------------------------------------------
  // Live Stripe path.
  // ---------------------------------------------------------------------------
  assertStripeConfigured();

  const db = serverDb();

  // Load user row.
  const { data: user, error: userError } = await db
    .from("users")
    .select("id, email, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user) {
    throw new Error(`checkout: user not found (id=${userId})`);
  }

  const stripe = stripeClient();

  // Ensure Stripe customer exists.
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId },
    });
    customerId = customer.id;

    const { error: persistError } = await db
      .from("users")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);

    if (persistError) {
      // Non-fatal: checkout can still proceed; customer id will be reconciled via webhook.
      console.error("checkout: failed to persist stripe_customer_id", persistError.message);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceIdFor(plan, interval),
        quantity: 1,
      },
    ],
    customer: customerId,
    client_reference_id: userId,
    metadata: { userId, plan, interval },
    // 7-day free trial: subscription is created in `trialing` status (card
    // collected now, first charge at trial end). entitlementsFor() already
    // treats "trialing" as active, so trial users get full paid access.
    subscription_data: { trial_period_days: 7 },
    success_url: `${env.appUrl}/app?upgraded=1`,
    cancel_url: `${env.appUrl}/app/billing`,
  });

  return { url: session.url ?? `${env.appUrl}/app/billing` };
}
