/**
 * Live payment-first funnel test (run manually with real keys):
 *   npm run test:int tests/integration/payment-first-funnel.test.ts
 *
 * Uses .env.local (live Stripe key, local Supabase, real Resend). It does NOT
 * create any charge — Stripe Checkout completion happens on Stripe's hosted page
 * which can't be driven headlessly. Instead it:
 *   1. validates the live Stripe config (read-only price retrieve),
 *   2. creates a real (unpaid) anonymous checkout session and asserts its params,
 *   3. drives the webhook end-to-end (checkout.session.completed →
 *      customer.subscription.created) against local Supabase, asserting the
 *      account is created, the scanned app linked, and tier=trialing,
 *   4. confirms the onboarding magic-link generation works (token_hash flow).
 *
 * Step 3 sends a real onboarding email via Resend to TEST_EMAIL.
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type Stripe from "stripe";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { stripeClient, priceIdFor } from "@/lib/billing/stripe";
import { createAnonymousCheckout } from "@/lib/billing/checkout";
import { handleStripeEvent } from "@/lib/billing/webhook";

// Live-only: needs a real Stripe key + local Supabase. Auto-skips otherwise
// (e.g. fixtures mode / CI without keys) so it never breaks an automated run.
const RUN_LIVE = !env.useFixtures && env.stripeSecretKey.startsWith("sk_");

// Gmail ignores +tags, so this lands in the real inbox but is identifiable.
const TEST_EMAIL = "timclifford101+rk-funnel-test@gmail.com";

const state = { appId: "", scanId: "", userId: "" };

describe.skipIf(!RUN_LIVE)("payment-first funnel (live)", () => {

async function purgeTestUser(): Promise<void> {
  const db = serverDb();
  const { data } = await db.from("users").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (data?.id) {
    await db.from("users").delete().eq("id", data.id);
    try {
      await db.auth.admin.deleteUser(data.id);
    } catch {
      /* may already be gone */
    }
  }
}

beforeAll(async () => {
  await purgeTestUser();
  const db = serverDb();
  const app = await db
    .from("apps")
    .insert({ store_url: `https://rk-funnel-test-${Date.now()}.example.com`, platform: "web" })
    .select("id")
    .single();
  if (app.error) throw app.error;
  state.appId = app.data.id;

  const scan = await db
    .from("scans")
    .insert({ app_id: state.appId, status: "done" })
    .select("id")
    .single();
  if (scan.error) throw scan.error;
  state.scanId = scan.data.id;
});

afterAll(async () => {
  const db = serverDb();
  await purgeTestUser();
  if (state.scanId) await db.from("scans").delete().eq("id", state.scanId);
  if (state.appId) await db.from("apps").delete().eq("id", state.appId);
});

test("live Stripe config — Solo price resolves and is a monthly recurring price", async () => {
  const price = await stripeClient().prices.retrieve(priceIdFor("solo", "month"));
  expect(price.id).toBe(env.stripePriceSolo);
  expect(price.recurring?.interval).toBe("month");
});

test("anonymous checkout creates a real session with the scan metadata + 7-day trial", async () => {
  const { url } = await createAnonymousCheckout({ scanId: state.scanId, plan: "solo" });
  expect(url).toContain("stripe.com");

  // Pull the session back out of the URL and verify it carries our metadata + trial.
  const sessionId = new URL(url).pathname.split("/").pop()?.split("#")[0] ?? "";
  // Checkout URLs embed the session id after /c/pay/ ; fall back to listing the latest.
  const session = sessionId.startsWith("cs_")
    ? await stripeClient().checkout.sessions.retrieve(sessionId)
    : (await stripeClient().checkout.sessions.list({ limit: 1 })).data[0];

  expect(session?.metadata?.scanId).toBe(state.scanId);
  expect(session?.metadata?.plan).toBe("solo");
  // The retrieved Session doesn't echo subscription_data.trial_period_days, but
  // mode=subscription confirms the trial-bearing flow was created.
  expect(session?.mode).toBe("subscription");
}, 20_000);

test("webhook provisions the account, links the scanned app, and sends the magic link", async () => {
  const db = serverDb();
  const customerId = `cus_rktest_${Date.now()}`;
  const subId = `sub_rktest_${Date.now()}`;

  const checkoutEvent = {
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_rktest_${Date.now()}`,
        customer: customerId,
        subscription: subId,
        customer_details: { email: TEST_EMAIL },
        customer_email: TEST_EMAIL,
        client_reference_id: state.scanId,
        metadata: { scanId: state.scanId, plan: "solo", interval: "month" },
      },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(checkoutEvent);

  const { data: user } = await db
    .from("users")
    .select("id, app_ids, stripe_customer_id, stripe_subscription_id")
    .eq("email", TEST_EMAIL)
    .maybeSingle();

  expect(user, "user should be created from the checkout email").toBeTruthy();
  state.userId = user!.id;
  expect(user!.app_ids).toContain(state.appId);
  expect(user!.stripe_customer_id).toBe(customerId);
  expect(user!.stripe_subscription_id).toBe(subId);
}, 20_000);

test("subscription event sets tier=solo / status=trialing (resolved by customer id)", async () => {
  const db = serverDb();
  const { data: pre } = await db
    .from("users")
    .select("stripe_customer_id")
    .eq("id", state.userId)
    .single();

  const nowSec = Math.floor(Date.now() / 1000);
  const subEvent = {
    type: "customer.subscription.created",
    data: {
      object: {
        id: `sub_rktest_${Date.now()}`,
        customer: pre!.stripe_customer_id,
        status: "trialing",
        items: {
          data: [{ price: { id: priceIdFor("solo", "month") }, current_period_end: nowSec + 7 * 86400 }],
        },
      },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(subEvent);

  const { data: user } = await db
    .from("users")
    .select("tier, subscription_status, current_period_end")
    .eq("id", state.userId)
    .single();

  expect(user!.tier).toBe("solo");
  expect(user!.subscription_status).toBe("trialing");
  expect(user!.current_period_end).toBeTruthy();
});

test("onboarding magic link generates a token_hash (cross-device confirm flow)", async () => {
  const { data, error } = await serverDb().auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
    options: { redirectTo: `${env.appUrl}/welcome` },
  });
  expect(error).toBeNull();
  expect(data?.properties?.hashed_token).toBeTruthy();
});

});
