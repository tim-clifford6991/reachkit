// tests/account/billing/webhook-route.test.ts — BUILD §13
//
// The join: a verified `subscription` event arriving at the webhook with
// **no handler registered** reaches `onSubscriptionEvent` and moves the
// gate.
//
// `tests/account/provisioning/webhook.test.ts` registers a double and
// asserts the routing; this suite asserts the wiring underneath it — that
// the default the webhook falls back to is this module and not a no-op. The
// two together are why a subscription event is not silently dropped in
// production, where nobody calls `registerSubscriptionHandler`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { handleStripeWebhook, registerSubscriptionHandler } = await import(
  "@/lib/account/provisioning/webhook"
);
const { hasActiveAccess, setBillingStore } = await import("@/lib/account/billing");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
const { newStripeDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");

let state = newMemoryBilling();
let vendor = newStripeDouble();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  vendor = newStripeDouble();
  vendor.verifies = true;
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  // The production state: nothing registered.
  registerSubscriptionHandler(null);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  setStripe(null);
  registerSubscriptionHandler(null);
  vi.restoreAllMocks();
});

describe("a subscription event with no handler registered still reaches billing", () => {
  it("the renewal advances paid_through and the gate turns true", async () => {
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    state.users.push(
      account({
        id: "u1",
        paid_through: NOW.toISOString(),
        stripe_customer_id: "cus_u1",
        stripe_subscription_id: "sub_1",
      })
    );
    state.sites.push(site({ id: "s1", user_id: "u1", owner_paid_through: NOW.toISOString() }));
    expect(await hasActiveAccess("s1")).toBe(false);

    vendor.event = {
      id: "evt_live",
      type: "customer.subscription.updated",
      data: {
        object: subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd }),
      },
    };

    const result = await handleStripeWebhook(Buffer.from("{}"), "sig");
    expect(result).toEqual({
      handled: true,
      event: "customer.subscription.updated",
      route: "subscription",
    });
    expect(storedUser(state).paid_through).toBe(periodEnd.toISOString());
    expect(await hasActiveAccess("s1")).toBe(true);
  });

  it("an unverified body reaches nothing at all", async () => {
    vendor.verifies = false;
    state.users.push(account({ id: "u1", paid_through: NOW.toISOString() }));
    const result = await handleStripeWebhook(Buffer.from("{}"), "sig");
    expect(result).toEqual({ handled: false, reason: "signature" });
    expect(storedUser(state).paid_through).toBe(NOW.toISOString());
  });
});
