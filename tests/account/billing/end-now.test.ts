// tests/account/billing/end-now.test.ts — REQ-079 c6
//
// "the subscription ends at once with no further charge and no remaining
// paid access."
//
// The discriminating case is the one that separates this from `cancel.ts`:
// after `cancelSubscription`, `hasActiveAccess` is still **true** to the
// paid-through date (REQ-076 c3); after `endSubscriptionNow` it is **false**
// immediately. Two functions, two promises, and folding them into one with a
// flag would put the customer-facing cancellation one boolean away from
// taking a paying customer's access away on the day they cancelled.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { cancelSubscription, endSubscriptionNow, hasActiveAccess, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import(
  "./memory-store"
);
const { newStripeDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");

let state = newMemoryBilling();
let vendor = newStripeDouble();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const PAID_THROUGH = new Date(NOW.getTime() + 20 * DAY);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  vendor = newStripeDouble();
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  setStripe(null);
  vi.restoreAllMocks();
});

function given(a: { subscription?: string | null } = {}): void {
  const subscriptionId = a.subscription === undefined ? "sub_1" : a.subscription;
  state.users.push(
    account({
      id: "u-1",
      stripe_subscription_id: subscriptionId,
      paid_through: PAID_THROUGH.toISOString(),
      plan_status: "active",
    })
  );
  state.sites.push(site({ id: "site-1", user_id: "u-1", owner_paid_through: PAID_THROUGH.toISOString() }));
  if (subscriptionId !== null) {
    vendor.subscriptions.set(
      subscriptionId,
      subscriptionDouble({ id: subscriptionId, customer: "cus_1", periodEnd: PAID_THROUGH })
    );
  }
}

describe("REQ-079 c6 — the subscription ends at once", () => {
  it("the vendor subscription is cancelled outright, not at period end", async () => {
    given();
    expect(await endSubscriptionNow("u-1", NOW)).toEqual({ ok: true, endedAt: NOW });
    expect(vendor.cancelled).toEqual(["sub_1"]);
    expect(vendor.subscriptionUpdates).toEqual([]);
  });

  it("paid_through moves to now, so hasActiveAccess is false immediately", async () => {
    given();
    expect(await hasActiveAccess("site-1")).toBe(true);
    await endSubscriptionNow("u-1", NOW);
    expect(new Date(storedUser(state).paid_through).getTime()).toBe(NOW.getTime());
    expect(await hasActiveAccess("site-1")).toBe(false);
  });

  it("the plan status is recorded as cancelled and the cancellation is stamped", async () => {
    given();
    await endSubscriptionNow("u-1", NOW);
    expect(storedUser(state).plan_status).toBe("canceled");
    expect(storedUser(state).cancelled_at).toBe(NOW.toISOString());
  });

  it("the discriminating case: cancelSubscription leaves access standing, this does not", async () => {
    given();
    await cancelSubscription("u-1");
    expect(await hasActiveAccess("site-1")).toBe(true);

    await endSubscriptionNow("u-1", NOW);
    expect(await hasActiveAccess("site-1")).toBe(false);
  });

  it("an account with no subscription still has its gate closed — there is nothing at the vendor to stop", async () => {
    given({ subscription: null });
    expect(await endSubscriptionNow("u-1", NOW)).toEqual({ ok: true, endedAt: NOW });
    expect(vendor.cancelled).toEqual([]);
    expect(await hasActiveAccess("site-1")).toBe(false);
  });
});

describe("REQ-079 c6 — the vendor first, so no customer is left paying with no access", () => {
  it("a vendor that refuses leaves the stored gate exactly where it was", async () => {
    given();
    vendor.cancelError = new Error("stripe is down");
    expect(await endSubscriptionNow("u-1", NOW)).toEqual({ ok: false, reason: "vendor" });
    expect(new Date(storedUser(state).paid_through).getTime()).toBe(PAID_THROUGH.getTime());
    expect(await hasActiveAccess("site-1")).toBe(true);
  });

  it("an account that cannot be read is refused rather than half-ended", async () => {
    expect(await endSubscriptionNow("u-1", NOW)).toEqual({ ok: false, reason: "store" });
    expect(vendor.cancelled).toEqual([]);
  });
});
