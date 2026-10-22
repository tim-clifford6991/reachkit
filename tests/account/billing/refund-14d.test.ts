// tests/account/billing/refund-14d.test.ts — owner D4: a cancel within 14
// days of the first payment refunds it by itself, once per web address.
//
// Driven at the webhook route with the Stripe SDK doubled and the billing
// store in memory. Two customers from the panel's two kinds: a local
// plumber and a SaaS scheduler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { POST } = await import("@/app/api/stripe/webhook/route");
const { registerSubscriptionHandler } = await import("@/lib/account/provisioning/webhook");
const { hasActiveAccess, resumeSubscription, setBillingStore } = await import("@/lib/account/billing");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
const { newStripeDouble, paidInvoiceDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");

const DAY = 24 * 60 * 60 * 1000;
const PAID = new Date("2026-10-01T09:00:00.000Z");
const PERIOD_END = new Date(PAID.getTime() + 30 * DAY);

let state = newMemoryBilling();
let vendor = newStripeDouble();
let warnings: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  state = newMemoryBilling();
  vendor = newStripeDouble();
  vendor.verifies = true;
  warnings = [];
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  registerSubscriptionHandler(null);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    warnings.push(String(line));
  });
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  setStripe(null);
  vi.restoreAllMocks();
});

/** A paying account, its site and its first paid invoice. */
function customer(a: { id: string; domain: string; paidAt?: Date }): void {
  const paidAt = a.paidAt ?? PAID;
  state.users.push(
    account({
      id: a.id,
      created_at: paidAt.toISOString(),
      paid_through: PERIOD_END.toISOString(),
      stripe_customer_id: `cus_${a.id}`,
      stripe_subscription_id: `sub_${a.id}`,
    })
  );
  state.sites.push(site({ id: `site_${a.id}`, user_id: a.id, owner_paid_through: PERIOD_END.toISOString() }));
  state.domains.push({ user_id: a.id, domain: a.domain });
  vendor.subscriptions.set(
    `sub_${a.id}`,
    subscriptionDouble({ id: `sub_${a.id}`, customer: `cus_${a.id}`, periodEnd: PERIOD_END })
  );
  vendor.invoices.push(paidInvoiceDouble({ id: `in_${a.id}`, customer: `cus_${a.id}`, paidAt }));
}

function at(days: number): void {
  vi.setSystemTime(new Date(PAID.getTime() + days * DAY));
}

/** Delivers one event through the real route and answers its status. */
async function deliver(event: Record<string, unknown>): Promise<number> {
  vendor.event = event;
  const response = await POST(
    new Request("https://reachkit.test/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig" },
      body: "{}",
    }),
    undefined as never
  );
  return response.status;
}

function cancelEvent(id: string, a: { eventId?: string; type?: string; status?: string } = {}): Record<string, unknown> {
  return {
    id: a.eventId ?? `evt_cancel_${id}`,
    type: a.type ?? "customer.subscription.updated",
    data: {
      object: subscriptionDouble({
        id: `sub_${id}`,
        customer: `cus_${id}`,
        periodEnd: PERIOD_END,
        status: a.status,
        cancelAtPeriodEnd: true,
      }),
    },
  };
}

describe("D4 — a cancel in the first 14 days refunds the first payment", () => {
  it("day 13: one full refund of the first invoice, keyed on it, and access ends now", async () => {
    customer({ id: "plumber", domain: "https://www.Northside-Plumbing.com/contact" });
    at(13);

    expect(await deliver(cancelEvent("plumber"))).toBe(200);

    expect(vendor.refundsCreated).toEqual([
      {
        params: { payment_intent: "pi_in_plumber", reason: "requested_by_customer", metadata: { invoice: "in_plumber" } },
        idempotencyKey: "refund:in_plumber",
      },
    ]);
    expect(vendor.cancelled).toEqual(["sub_plumber"]);
    expect(storedUser(state).paid_through).toBe(new Date(PAID.getTime() + 13 * DAY).toISOString());
    expect(await hasActiveAccess("site_plumber")).toBe(false);
    expect(state.refunds).toMatchObject([{ invoice_id: "in_plumber", user_id: "plumber", domains: ["northside-plumbing.com"] }]);
    // Hosted pages are not touched here; the 30-day path starts from the new date.
    expect(state.sites[0]?.hosted_serving_ends_at).toBeNull();
  });

  it("day 15: no refund, and access runs to the period end", async () => {
    customer({ id: "plumber", domain: "northside-plumbing.com" });
    at(15);

    expect(await deliver(cancelEvent("plumber"))).toBe(200);

    expect(vendor.refundsCreated).toEqual([]);
    expect(vendor.cancelled).toEqual([]);
    expect(storedUser(state).paid_through).toBe(PERIOD_END.toISOString());
    expect(await hasActiveAccess("site_plumber")).toBe(true);
  });

  it("a re-delivery, and the deletion Stripe sends after the immediate cancel, refund nothing more and keep access ended", async () => {
    customer({ id: "scheduler", domain: "schedulepilot.io" });
    at(2);

    await deliver(cancelEvent("scheduler"));
    await deliver(cancelEvent("scheduler"));
    const endedAt = Math.floor(Date.now() / 1000);
    at(2.01);
    await deliver({
      id: "evt_deleted_scheduler",
      type: "customer.subscription.deleted",
      data: {
        object: {
          ...subscriptionDouble({ id: "sub_scheduler", customer: "cus_scheduler", periodEnd: PERIOD_END, status: "canceled" }),
          ended_at: endedAt,
        },
      },
    });

    expect(vendor.refundsCreated).toHaveLength(1);
    expect(state.refunds).toHaveLength(1);
    expect(await hasActiveAccess("site_scheduler")).toBe(false);
  });

  it("an invoice event never refunds, even for a plan set to cancel", async () => {
    customer({ id: "plumber", domain: "northside-plumbing.com" });
    vendor.subscriptions.set(
      "sub_plumber",
      subscriptionDouble({ id: "sub_plumber", customer: "cus_plumber", periodEnd: PERIOD_END, cancelAtPeriodEnd: true })
    );
    at(3);

    await deliver({
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: { object: { id: "in_x", parent: { type: "subscription_details", subscription_details: { subscription: "sub_plumber" } } } },
    });

    expect(vendor.refundsCreated).toEqual([]);
  });
});

describe("D4 — once per web address, read from stored rows", () => {
  it("a second account for an already refunded domain, cancelled on day 3, gets no refund", async () => {
    customer({ id: "plumber", domain: "northside-plumbing.com" });
    at(1);
    await deliver(cancelEvent("plumber"));
    expect(vendor.refundsCreated).toHaveLength(1);

    // A new address, a new Stripe customer, the same site written another way.
    const secondPaid = new Date(PAID.getTime() + 20 * DAY);
    customer({ id: "plumber2", domain: "WWW.northside-plumbing.com", paidAt: secondPaid });
    vi.setSystemTime(new Date(secondPaid.getTime() + 3 * DAY));
    expect(await deliver(cancelEvent("plumber2"))).toBe(200);

    expect(vendor.refundsCreated).toHaveLength(1);
    expect(storedUser(state, 1).paid_through).toBe(PERIOD_END.toISOString());
    expect(await hasActiveAccess("site_plumber2")).toBe(true);
  });

  it("another web address is refunded in its own first 14 days", async () => {
    customer({ id: "plumber", domain: "northside-plumbing.com" });
    customer({ id: "scheduler", domain: "schedulepilot.io" });
    at(1);
    await deliver(cancelEvent("plumber"));
    await deliver(cancelEvent("scheduler"));

    expect(vendor.refundsCreated.map((r) => r.idempotencyKey)).toEqual(["refund:in_plumber", "refund:in_scheduler"]);
  });
});

describe("a refund Stripe refuses", () => {
  it("answers 200, keeps access, logs the invoice, and the re-delivery refunds once", async () => {
    customer({ id: "scheduler", domain: "schedulepilot.io" });
    at(5);
    vendor.refundError = new Error("stripe is down");

    expect(await deliver(cancelEvent("scheduler"))).toBe(200);
    expect(vendor.refundsCreated).toEqual([]);
    expect(vendor.cancelled).toEqual([]);
    expect(storedUser(state).paid_through).toBe(PERIOD_END.toISOString());
    expect(await hasActiveAccess("site_scheduler")).toBe(true);
    expect(warnings.some((line) => line.includes("billing_refund") && line.includes("in_scheduler"))).toBe(true);

    vendor.refundError = null;
    at(6);
    expect(await deliver(cancelEvent("scheduler"))).toBe(200);
    expect(vendor.refundsCreated).toHaveLength(1);
    expect(await hasActiveAccess("site_scheduler")).toBe(false);
  });
});

describe("a refunded customer who resumes and later cancels at period end", () => {
  it("keeps the month they paid for: the new subscription is not ended and nothing more is refunded", async () => {
    customer({ id: "scheduler", domain: "schedulepilot.io" });
    at(2);
    await deliver(cancelEvent("scheduler"));
    expect(vendor.refundsCreated).toHaveLength(1);
    expect(await hasActiveAccess("site_scheduler")).toBe(false);
    vendor.subscriptions.set("sub_scheduler", {
      ...(vendor.subscriptions.get("sub_scheduler") as object),
      status: "canceled",
    });

    at(3);
    expect((await resumeSubscription("scheduler")).ok).toBe(true);
    const resumed = storedUser(state).stripe_subscription_id as string;
    expect(resumed).not.toBe("sub_scheduler");
    expect(await hasActiveAccess("site_scheduler")).toBe(true);
    const paidThrough = storedUser(state).paid_through;

    at(25);
    const sub = vendor.subscriptions.get(resumed) as Record<string, unknown>;
    expect(
      await deliver({
        id: "evt_cancel_resumed",
        type: "customer.subscription.updated",
        data: { object: { ...sub, cancel_at_period_end: true } },
      })
    ).toBe(200);
    expect(vendor.refundsCreated).toHaveLength(1);
    expect(storedUser(state).paid_through).toBe(paidThrough);
    expect(await hasActiveAccess("site_scheduler")).toBe(true);
  });
});
