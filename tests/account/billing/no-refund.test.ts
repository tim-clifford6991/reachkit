// tests/account/billing/no-refund.test.ts — owner 2026-11-06: the plan is
// month to month and nothing is refunded by itself, neither a cancel in the
// first 14 days nor a first renewal with no page live.
//
// Driven at the webhook route with the Stripe SDK doubled and the billing
// store in memory, for a local plumber and a SaaS scheduler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { POST } = await import("@/app/api/stripe/webhook/route");
const { registerSubscriptionHandler } = await import("@/lib/account/provisioning/webhook");
const { hasActiveAccess, setBillingStore } = await import("@/lib/account/billing");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
const { newStripeDouble, paidInvoiceDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");

const DAY = 24 * 60 * 60 * 1000;
const PAID = new Date("2026-10-01T09:00:00.000Z");
const PERIOD_END = new Date(PAID.getTime() + 31 * DAY);

let state = newMemoryBilling();
let vendor = newStripeDouble();
let mails: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  state = newMemoryBilling();
  vendor = newStripeDouble();
  vendor.verifies = true;
  mails = [];
  __setVendorTransportForTesting(async (payload) => {
    mails.push((JSON.parse(payload) as { text: string }).text);
    return { status: 200, headers: {}, body: JSON.stringify({ id: `mail_${mails.length}` }) };
  });
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  registerSubscriptionHandler(null);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  setStripe(null);
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

/** A paying account in its first month, and its site with no page live. */
function customer(id: string): void {
  state.users.push(
    account({
      id,
      paid_through: PERIOD_END.toISOString(),
      stripe_customer_id: `cus_${id}`,
      stripe_subscription_id: `sub_${id}`,
    })
  );
  state.sites.push(site({ id: `site_${id}`, user_id: id, owner_paid_through: PERIOD_END.toISOString() }));
}

async function deliver(event: Record<string, unknown>): Promise<number> {
  vendor.event = event;
  const response = await POST(
    new Request("https://reachkit.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }),
    undefined as never
  );
  return response.status;
}

function cancelEvent(id: string, a: { eventId?: string; type?: string; status?: string } = {}): Record<string, unknown> {
  return {
    id: a.eventId ?? `evt_cancel_${id}`,
    type: a.type ?? "customer.subscription.updated",
    data: {
      object: subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: PERIOD_END, status: a.status, cancelAtPeriodEnd: true }),
    },
  };
}

describe("a cancel in the first 14 days is never refunded by itself", () => {
  it.each(["plumber", "scheduler"])("%s on day 2: 200, no refund, and access runs to paid_through", async (id) => {
    customer(id);
    vi.setSystemTime(new Date(PAID.getTime() + 2 * DAY));

    expect(await deliver(cancelEvent(id))).toBe(200);

    expect(vendor.refundsCreated).toEqual([]);
    expect(vendor.cancelled).toEqual([]);
    expect(storedUser(state).paid_through).toBe(PERIOD_END.toISOString());
    expect(storedUser(state).cancelled_at).not.toBeNull();
    expect(await hasActiveAccess(`site_${id}`)).toBe(true);
    expect(mails).toEqual([]);
  });

  it("a re-delivery and the later deletion both answer 200 and refund nothing", async () => {
    customer("scheduler");
    vi.setSystemTime(new Date(PAID.getTime() + 2 * DAY));

    expect(await deliver(cancelEvent("scheduler"))).toBe(200);
    expect(await deliver(cancelEvent("scheduler"))).toBe(200);
    expect(await deliver(cancelEvent("scheduler", { eventId: "evt_deleted", type: "customer.subscription.deleted", status: "canceled" }))).toBe(200);

    expect(vendor.refundsCreated).toEqual([]);
    expect(storedUser(state).paid_through).toBe(PERIOD_END.toISOString());
  });
});

describe("a first renewal with no page live is never refunded by itself", () => {
  it.each(["plumber", "scheduler"])("%s: 200, no refund, no mail, and access runs into the new month", async (id) => {
    customer(id);
    const nextEnd = new Date(PERIOD_END.getTime() + 30 * DAY);
    vendor.subscriptions.set(`sub_${id}`, subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: nextEnd }));
    const invoice = paidInvoiceDouble({ id: `in_renew_${id}`, customer: `cus_${id}`, paidAt: PERIOD_END, renews: { from: PAID, to: PERIOD_END } });
    vi.setSystemTime(new Date(PERIOD_END.getTime() + 60 * 1000));
    const event = {
      id: `evt_paid_${id}`,
      type: "invoice.paid",
      data: { object: { ...invoice, parent: { type: "subscription_details", subscription_details: { subscription: `sub_${id}` } } } },
    };

    expect(await deliver(event)).toBe(200);
    expect(await deliver(event)).toBe(200);

    expect(vendor.refundsCreated).toEqual([]);
    expect(mails).toEqual([]);
    expect(storedUser(state).paid_through).toBe(nextEnd.toISOString());
    expect(await hasActiveAccess(`site_${id}`)).toBe(true);
  });
});
