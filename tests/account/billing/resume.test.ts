// tests/account/billing/resume.test.ts — REQ-076 c6; REQ-097 c3
//
// Coming back, before and after the date, without asking anyone — and the
// column-set assertion that keeps c6's real promise: the customer returns
// "onto the same domain, category and competitor set they left with", which
// is kept by writing nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { resumeSubscription, hasActiveAccess, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { setStripe } = await import("@/lib/account/stripe/client");
const { env } = await import("@/lib/config/env");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser, storedSite } = await import("./memory-store");
const { newStripeDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");

/** The nth recorded item, or a failure that names the index. An optional
 *  index access would let an assertion be quietly made about nothing. */
function at<T>(items: readonly T[], index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`nothing recorded at [${index}]`);
  return item;
}

let state = newMemoryBilling();
let vendor = newStripeDouble();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

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

/** A cancelled account, either still inside its paid period or past it. */
function cancelled(a: { paidThrough: Date; subscriptionEnded: boolean }): void {
  state.users.push(
    account({
      id: "u1",
      paid_through: a.paidThrough.toISOString(),
      cancelled_at: new Date(NOW.getTime() - DAY).toISOString(),
      stripe_customer_id: "cus_u1",
      stripe_subscription_id: "sub_1",
    })
  );
  vendor.subscriptions.set(
    "sub_1",
    subscriptionDouble({
      id: "sub_1",
      customer: "cus_u1",
      periodEnd: a.paidThrough,
      status: a.subscriptionEnded ? "canceled" : "active",
      cancelAtPeriodEnd: true,
    })
  );
}

describe("REQ-076 c6 — resume before the date", () => {
  it("un-cancels the subscription the customer already has", async () => {
    const paidThrough = new Date(NOW.getTime() + 10 * DAY);
    cancelled({ paidThrough, subscriptionEnded: false });

    const result = await resumeSubscription("u1");
    expect(result).toEqual({ ok: true, paidThrough });
    expect(vendor.subscriptionUpdates).toEqual([
      { id: "sub_1", params: { cancel_at_period_end: false } },
    ]);
    // Nothing new is bought: the customer is inside a period they paid for.
    expect(vendor.subscriptionsCreated).toEqual([]);
    expect(storedUser(state).cancelled_at).toBeNull();
  });
});

describe("REQ-076 c6 — resume after the date", () => {
  it("creates a new subscription against the existing customer, at the one price", async () => {
    const paidThrough = new Date(NOW.getTime() - 10 * DAY);
    cancelled({ paidThrough, subscriptionEnded: true });

    const result = await resumeSubscription("u1");
    expect(result.ok).toBe(true);
    expect(vendor.subscriptionsCreated).toHaveLength(1);
    expect(at(vendor.subscriptionsCreated).customer).toBe("cus_u1");
    expect(at(vendor.subscriptionsCreated).items).toEqual([
      { price: env.STRIPE_PRICE_ID, quantity: 1 },
    ]);
  });

  it("REQ-097 c3 — no card is asked for: the customer's payment method is Stripe's", async () => {
    const paidThrough = new Date(NOW.getTime() - 10 * DAY);
    cancelled({ paidThrough, subscriptionEnded: true });
    await resumeSubscription("u1");
    // The whole of what is sent is a customer and a price. No card, no
    // payment form, no billing form.
    expect(Object.keys(at(vendor.subscriptionsCreated)).sort()).toEqual(["customer", "items"]);
    expect(vendor.chargesCreated).toBe(0);
  });

  it("advances paid_through, so the gate is true again", async () => {
    const paidThrough = new Date(NOW.getTime() - 10 * DAY);
    cancelled({ paidThrough, subscriptionEnded: true });
    state.sites.push(site({ id: "s1", user_id: "u1", owner_paid_through: paidThrough.toISOString() }));

    expect(await hasActiveAccess("s1")).toBe(false);
    const result = await resumeSubscription("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.paidThrough.getTime()).toBeGreaterThan(NOW.getTime());
    expect(storedUser(state).paid_through).toBe(result.paidThrough.toISOString());
  });
});

describe("REQ-076 c6 — the customer returns to what they left", () => {
  it("no sites column changes on resume, except the retention clock", async () => {
    const paidThrough = new Date(NOW.getTime() + 5 * DAY);
    cancelled({ paidThrough, subscriptionEnded: false });
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: paidThrough.toISOString(),
        hosted_serving_ends_at: new Date(NOW.getTime() + 25 * DAY).toISOString(),
        hosting_end_notice_at: NOW.toISOString(),
        hosting_end_reminder_at: NOW.toISOString(),
        timezone: "Europe/Berlin",
      })
    );
    const before = { ...storedSite(state) };

    await resumeSubscription("u1");
    const after = storedSite(state);

    // The three that changed are the countdown that started because they
    // left — not a setting they chose.
    expect(after.hosted_serving_ends_at).toBeNull();
    expect(after.hosting_end_notice_at).toBeNull();
    expect(after.hosting_end_reminder_at).toBeNull();

    // Everything else is byte-identical.
    const untouched = (row: typeof after) => ({
      ...row,
      hosted_serving_ends_at: null,
      hosting_end_notice_at: null,
      hosting_end_reminder_at: null,
    });
    expect(untouched(after)).toEqual(untouched(before));
    expect(after.timezone).toBe("Europe/Berlin");
  });

  it("a site that never had a countdown is untouched entirely", async () => {
    const paidThrough = new Date(NOW.getTime() + 5 * DAY);
    cancelled({ paidThrough, subscriptionEnded: false });
    state.sites.push(site({ id: "s1", user_id: "u1" }));
    const before = { ...storedSite(state) };
    await resumeSubscription("u1");
    expect(storedSite(state)).toEqual(before);
  });
});

describe("what it says when it will not resume", () => {
  it("a plan that was never cancelled is `not_cancelled`", async () => {
    state.users.push(account({ id: "u1", cancelled_at: null }));
    expect(await resumeSubscription("u1")).toEqual({ ok: false, reason: "not_cancelled" });
    expect(vendor.subscriptionsCreated).toEqual([]);
  });

  it("an account with no Stripe customer is `no_customer`", async () => {
    state.users.push(
      account({ id: "u1", cancelled_at: NOW.toISOString(), stripe_customer_id: null })
    );
    expect(await resumeSubscription("u1")).toEqual({ ok: false, reason: "no_customer" });
  });

  it("a vendor that refuses leaves the cancellation standing", async () => {
    cancelled({ paidThrough: new Date(NOW.getTime() + 5 * DAY), subscriptionEnded: false });
    vendor.subscriptionUpdateError = new Error("stripe is down");
    expect(await resumeSubscription("u1")).toEqual({ ok: false, reason: "vendor" });
    expect(storedUser(state).cancelled_at).not.toBeNull();
  });

  it("the last event id survives a resume, so a replay is still recognised", async () => {
    const paidThrough = new Date(NOW.getTime() + 5 * DAY);
    cancelled({ paidThrough, subscriptionEnded: false });
    state.users[0] = account({
      id: "u1",
      paid_through: paidThrough.toISOString(),
      cancelled_at: NOW.toISOString(),
      stripe_customer_id: "cus_u1",
      stripe_subscription_id: "sub_1",
      last_subscription_event_id: "evt_seen",
    });
    await resumeSubscription("u1");
    // A resume is not an event and carries no id; blanking the column would
    // make an already-applied event apply a second time.
    expect(storedUser(state).last_subscription_event_id).toBe("evt_seen");
  });
});
