// tests/account/billing/refund-no-live.test.ts — owner D10: a first renewal
// is refunded, and access runs on, when no page went live in the first month.
//
// Driven at the webhook route with the Stripe SDK doubled and the billing
// store in memory. Two customers from the panel's two kinds: a local
// plumber and a SaaS scheduler.
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
const { copy } = await import("@/lib/presentation/copy");

const DAY = 24 * 60 * 60 * 1000;
const PAID = new Date("2026-10-01T09:00:00.000Z");
const RENEWED = new Date(PAID.getTime() + 31 * DAY);
const SECOND_RENEWAL = new Date(RENEWED.getTime() + 30 * DAY);

let state = newMemoryBilling();
let vendor = newStripeDouble();
let mails: { to: string; text: string }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  state = newMemoryBilling();
  vendor = newStripeDouble();
  vendor.verifies = true;
  mails = [];
  __setVendorTransportForTesting(async (payload) => {
    const mail = JSON.parse(payload) as { to: string | string[]; text: string };
    mails.push({ to: String(mail.to), text: mail.text });
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

/** A paying account in its first month, its site and its first paid invoice. */
function customer(id: string): void {
  state.users.push(
    account({
      id,
      email: `${id}@example.com`,
      created_at: PAID.toISOString(),
      paid_through: RENEWED.toISOString(),
      stripe_customer_id: `cus_${id}`,
      stripe_subscription_id: `sub_${id}`,
    })
  );
  state.sites.push(site({ id: `site_${id}`, user_id: id, owner_paid_through: RENEWED.toISOString() }));
  vendor.invoices.push(paidInvoiceDouble({ id: `in_first_${id}`, customer: `cus_${id}`, paidAt: PAID }));
}

/** A publication row on the customer's site. */
function publication(id: string, publishedAt: Date, a: { delivery_state?: "claimed" | "failed"; unpublishedAt?: Date } = {}): void {
  state.publications.push({
    site_id: `site_${id}`,
    published_at: publishedAt.toISOString(),
    unpublished_at: a.unpublishedAt?.toISOString() ?? null,
    title: "Emergency plumber open now",
    refresh: false,
    rule_failures: null,
    meta: null,
    ...(a.delivery_state === undefined ? {} : { delivery_state: a.delivery_state }),
  });
}

/** Stripe renews the subscription: the renewal invoice is paid, the period moves on. */
function renewal(id: string, invoiceId: string, from: Date, to: Date): Record<string, unknown> {
  const nextEnd = new Date(to.getTime() + 30 * DAY);
  vendor.subscriptions.set(`sub_${id}`, subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: nextEnd }));
  const invoice = paidInvoiceDouble({ id: invoiceId, customer: `cus_${id}`, paidAt: to, renews: { from, to } });
  vendor.invoices.push(invoice);
  vi.setSystemTime(new Date(to.getTime() + 60 * 1000));
  return {
    id: `evt_paid_${invoiceId}`,
    type: "invoice.paid",
    data: { object: { ...invoice, parent: { type: "subscription_details", subscription_details: { subscription: `sub_${id}` } } } },
  };
}

async function deliver(event: Record<string, unknown>): Promise<number> {
  vendor.event = event;
  const response = await POST(
    new Request("https://reachkit.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }),
    undefined as never
  );
  return response.status;
}

function refundMails(): { to: string; text: string }[] {
  return mails.filter((mail) => mail.text.includes(copy("mail.account.renewal_refunded")));
}

describe("D10 — the first renewal is refunded when no page went live in the first month", () => {
  it.each(["plumber", "scheduler"])("%s, 0 live pages: one full refund keyed on the invoice, one mail, and access runs on", async (id) => {
    customer(id);

    expect(await deliver(renewal(id, `in_renew_${id}`, PAID, RENEWED))).toBe(200);

    expect(vendor.refundsCreated).toEqual([
      {
        params: { payment_intent: `pi_in_renew_${id}`, reason: "requested_by_customer", metadata: { invoice: `in_renew_${id}` } },
        idempotencyKey: `refund:in_renew_${id}`,
      },
    ]);
    expect(state.renewalRefunds).toMatchObject([{ invoice_id: `in_renew_${id}`, user_id: id }]);
    expect(refundMails()).toEqual([expect.objectContaining({ to: `${id}@example.com` })]);
    expect(vendor.cancelled).toEqual([]);
    expect(Date.parse(storedUser(state).paid_through)).toBeGreaterThan(RENEWED.getTime());
    expect(await hasActiveAccess(`site_${id}`)).toBe(true);
    // D4's ledger is not written, so no web address loses its first-14-days refund.
    expect(state.refunds).toEqual([]);
  });

  it("1 live page in the first month: no refund and no mail", async () => {
    customer("plumber");
    publication("plumber", new Date(PAID.getTime() + 20 * DAY));

    await deliver(renewal("plumber", "in_renew", PAID, RENEWED));

    expect(vendor.refundsCreated).toEqual([]);
    expect(state.renewalRefunds).toEqual([]);
    expect(refundMails()).toEqual([]);
  });

  it("a page that went live and was taken down since still went live", async () => {
    customer("scheduler");
    publication("scheduler", new Date(PAID.getTime() + 10 * DAY), { unpublishedAt: new Date(PAID.getTime() + 12 * DAY) });

    await deliver(renewal("scheduler", "in_renew", PAID, RENEWED));

    expect(vendor.refundsCreated).toEqual([]);
  });

  it("a second renewal is never refunded, however many pages went live", async () => {
    customer("scheduler");
    publication("scheduler", new Date(PAID.getTime() + 20 * DAY));
    await deliver(renewal("scheduler", "in_renew_1", PAID, RENEWED));

    await deliver(renewal("scheduler", "in_renew_2", RENEWED, SECOND_RENEWAL));

    expect(vendor.refundsCreated).toEqual([]);
    expect(refundMails()).toEqual([]);
  });

  it("a re-delivery of the paid renewal refunds once and mails once", async () => {
    customer("plumber");
    const event = renewal("plumber", "in_renew", PAID, RENEWED);

    await deliver(event);
    await deliver(event);
    vi.setSystemTime(new Date(RENEWED.getTime() + 3 * DAY));
    await deliver(event);

    expect(vendor.refundsCreated).toHaveLength(1);
    expect(state.renewalRefunds).toHaveLength(1);
    expect(refundMails()).toHaveLength(1);
  });

  it("a first payment is never refunded here", async () => {
    customer("plumber");
    vendor.subscriptions.set("sub_plumber", subscriptionDouble({ id: "sub_plumber", customer: "cus_plumber", periodEnd: RENEWED }));
    vi.setSystemTime(new Date(PAID.getTime() + 60 * 1000));

    await deliver({
      id: "evt_paid_first",
      type: "invoice.paid",
      data: {
        object: {
          ...paidInvoiceDouble({ id: "in_first_plumber", customer: "cus_plumber", paidAt: PAID }),
          parent: { type: "subscription_details", subscription_details: { subscription: "sub_plumber" } },
        },
      },
    });

    expect(vendor.refundsCreated).toEqual([]);
  });

  it("a count that cannot be read refunds nothing", async () => {
    customer("scheduler");
    const event = renewal("scheduler", "in_renew", PAID, RENEWED);
    state.failHostingRead = true;

    await deliver(event);

    expect(vendor.refundsCreated).toEqual([]);
    expect(refundMails()).toEqual([]);
  });
});

describe("D10 — went live is read from publication rows, never drafts", () => {
  it("claimed or failed deliveries, and pages live only after the first month, leave the renewal refunded", async () => {
    customer("plumber");
    publication("plumber", new Date(PAID.getTime() + 5 * DAY), { delivery_state: "claimed" });
    publication("plumber", new Date(PAID.getTime() + 6 * DAY), { delivery_state: "failed" });
    publication("plumber", new Date(RENEWED.getTime() + 2 * 60 * 1000));

    await deliver(renewal("plumber", "in_renew", PAID, RENEWED));

    expect(vendor.refundsCreated).toHaveLength(1);
  });

  it("a page delivered on the last day of the first month counts", async () => {
    customer("scheduler");
    publication("scheduler", new Date(RENEWED.getTime() - 60 * 1000));

    await deliver(renewal("scheduler", "in_renew", PAID, RENEWED));

    expect(vendor.refundsCreated).toEqual([]);
  });
});
