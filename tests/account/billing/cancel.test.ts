// tests/account/billing/cancel.test.ts — REQ-076 c3, c7
//
// Cancelling cuts nothing off now. The discriminating case is the one that
// looks redundant: after cancelling, `hasActiveAccess` is still true.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { cancelSubscription, hasActiveAccess, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { HOSTED_RETENTION_DAYS } = await import("@/lib/config/constants");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
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

/** A paid-up account with one hosted site and a live subscription. */
function paying(a: { hosted?: boolean } = {}): void {
  state.users.push(
    account({ id: "u1", paid_through: PAID_THROUGH.toISOString(), stripe_subscription_id: "sub_1" })
  );
  state.sites.push(
    site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: PAID_THROUGH.toISOString(),
      hasHostedPages: a.hosted ?? true,
    })
  );
  vendor.subscriptions.set(
    "sub_1",
    subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd: PAID_THROUGH })
  );
}

describe("REQ-076 c3 — cancelling cuts nothing off now", () => {
  it("cancels at period end, and never immediately", async () => {
    paying();
    await cancelSubscription("u1");
    expect(vendor.subscriptionUpdates).toEqual([
      { id: "sub_1", params: { cancel_at_period_end: true } },
    ]);
    // The immediate cancel exists on the double and must never be reached.
    expect(vendor.cancelled).toEqual([]);
  });

  it("returns the unchanged paid_through as accessEndsAt", async () => {
    paying();
    const result = await cancelSubscription("u1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accessEndsAt).toEqual(PAID_THROUGH);
    expect(storedUser(state).paid_through).toBe(PAID_THROUGH.toISOString());
  });

  it("hasActiveAccess is still true after cancelling", async () => {
    // The discriminating case. A gate that also asked whether the
    // subscription was cancelled would take the rest of a paid month from
    // somebody who paid for it.
    paying();
    await cancelSubscription("u1");
    expect(await hasActiveAccess("s1")).toBe(true);
  });

  it("stamps cancelled_at, which is a record and not the gate", async () => {
    paying();
    await cancelSubscription("u1");
    expect(storedUser(state).cancelled_at).toBe(NOW.toISOString());
  });
});

describe("REQ-076 c7 — the day hosted pages stop being served", () => {
  it("HOSTED_RETENTION_DAYS after access ends, where hosted pages exist", async () => {
    paying({ hosted: true });
    const result = await cancelSubscription("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.hostedServingEndsAt).toEqual(
      new Date(PAID_THROUGH.getTime() + HOSTED_RETENTION_DAYS * DAY)
    );
  });

  it("null where the customer has no hosted pages", async () => {
    // A customer publishing only to their own WordPress has no such day,
    // and stating one would be stating a fact about nothing.
    paying({ hosted: false });
    const result = await cancelSubscription("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.hostedServingEndsAt).toBeNull();
  });
});

describe("what it says when it will not cancel", () => {
  it("a second cancel is `already_cancelled`, and writes nothing", async () => {
    paying();
    state.users[0] = account({
      id: "u1",
      paid_through: PAID_THROUGH.toISOString(),
      stripe_subscription_id: "sub_1",
      cancelled_at: "2026-09-01T00:00:00.000Z",
    });
    expect(await cancelSubscription("u1")).toEqual({ ok: false, reason: "already_cancelled" });
    expect(vendor.subscriptionUpdates).toEqual([]);
    expect(storedUser(state).cancelled_at).toBe("2026-09-01T00:00:00.000Z");
  });

  it("an account with no subscription is `no_subscription`", async () => {
    state.users.push(account({ id: "u1", stripe_subscription_id: null }));
    expect(await cancelSubscription("u1")).toEqual({ ok: false, reason: "no_subscription" });
  });

  it("a vendor that refuses cancels nothing here either", async () => {
    paying();
    vendor.subscriptionUpdateError = new Error("stripe is down");
    const result = await cancelSubscription("u1");
    expect(result).toEqual({ ok: false, reason: "vendor" });
    expect(storedUser(state).cancelled_at).toBeNull();
    expect(JSON.stringify(result)).not.toContain("stripe is down");
  });

  it("a store that cannot be read is `store`", async () => {
    state.failAccountRead = true;
    expect(await cancelSubscription("u1")).toEqual({ ok: false, reason: "store" });
  });
});
