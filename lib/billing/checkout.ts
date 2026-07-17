import { serverDb } from "@/lib/db/client";
import { fixtures } from "@/lib/scan/fixture-seam";
import { env } from "@/lib/config/env";
import { provisionCheckoutUser } from "@/lib/billing/provision";
import { safeReturnPath } from "@/lib/billing/return-path";
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
    ? `${env.appUrl}/scan/${scanId}`
    : `${env.appUrl}/#pricing`;

  // Fixtures path — no Stripe, no webhook. Provision the account inline so the
  // funnel is demoable keyless, then drop the user at /welcome.
  if (fixtures()) {
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
    // No free trial — the free scan is the only free capability. Paid plans are
    // charged immediately at checkout.
    // EU CRD: explicit ToS consent at checkout — the Terms carry the
    // immediate-performance / withdrawal-waiver clause (Task 6.4).
    consent_collection: { terms_of_service: "required" },
    success_url: `${env.appUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  });

  return { url: session.url ?? cancelUrl };
}

export async function createCheckout({
  userId,
  plan,
  interval = "month",
  returnPath,
}: {
  userId: string;
  plan: "solo" | "growth";
  interval?: BillingInterval;
  /** Where Back/cancel returns the user (the surface they came from). */
  returnPath?: string;
}): Promise<{ url: string }> {
  // Where Stripe's "Back" (cancel_url) drops the user — the initiating surface,
  // never a hard-coded /app/billing they never visited.
  const cancelUrl = `${env.appUrl}${safeReturnPath(returnPath)}`;
  // ---------------------------------------------------------------------------
  // Fixture path — no Stripe; directly upgrade the user row for demo/test.
  // ---------------------------------------------------------------------------
  if (fixtures()) {
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
    .select("id, email, stripe_customer_id, subscription_status")
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
    // No free trial — paid plans are charged immediately at checkout.
    // EU CRD: explicit ToS consent at checkout — the Terms carry the
    // immediate-performance / withdrawal-waiver clause (Task 6.4).
    consent_collection: { terms_of_service: "required" },
    success_url: `${env.appUrl}/app?upgraded=1`,
    cancel_url: cancelUrl,
  });

  return { url: session.url ?? cancelUrl };
}
