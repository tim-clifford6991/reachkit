// tests/account/billing/refund-retry.test.ts — a refund whose Stripe call or
// store write failed for a reason that will pass answers 500, so Stripe
// redelivers, and the redelivery refunds, records and mails exactly once.
// A permanent refusal answers 200 and tells the owner, as before.
//
// Driven at the webhook route with the Stripe SDK doubled and the billing
// store in memory, for a local plumber and a SaaS scheduler.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

// The platform's `waitUntil`: work handed to `after` runs once the response is out.
const { afterTasks } = vi.hoisted(() => ({ afterTasks: [] as (() => unknown)[] }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => void afterTasks.push(task) }));

const { POST } = await import("@/app/api/stripe/webhook/route");
const { registerSubscriptionHandler } = await import("@/lib/account/provisioning/webhook");
const { hasActiveAccess, setBillingStore } = await import("@/lib/account/billing");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
const { newStripeDouble, paidInvoiceDouble, stripeDouble, stripeErrors, subscriptionDouble } = await import("../stripe-double");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
const { copy } = await import("@/lib/presentation/copy");

const DAY = 24 * 60 * 60 * 1000;
const PAID = new Date("2026-10-01T09:00:00.000Z");
const RENEWED = new Date(PAID.getTime() + 31 * DAY);

let state = newMemoryBilling();
let vendor = newStripeDouble();
let mails: { to: string; text: string }[] = [];
let mailDown = false;

beforeEach(() => {
  vi.useFakeTimers();
  state = newMemoryBilling();
  vendor = newStripeDouble();
  vendor.verifies = true;
  mails = [];
  mailDown = false;
  afterTasks.length = 0;
  __setVendorTransportForTesting(async (payload) => {
    if (mailDown) return { status: 503, headers: {}, body: "{}" };
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

/** A paying account in its first month, its site, its domain and its first paid invoice. */
function customer(id: string): void {
  state.users.push(
    account({
      id,
      created_at: PAID.toISOString(),
      paid_through: RENEWED.toISOString(),
      stripe_customer_id: `cus_${id}`,
      stripe_subscription_id: `sub_${id}`,
    })
  );
  state.sites.push(site({ id: `site_${id}`, user_id: id, owner_paid_through: RENEWED.toISOString() }));
  state.domains.push({ user_id: id, domain: `${id}.example.com` });
  vendor.subscriptions.set(`sub_${id}`, subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: RENEWED }));
  vendor.invoices.push(paidInvoiceDouble({ id: `in_first_${id}`, customer: `cus_${id}`, paidAt: PAID }));
}

/** Stripe renews the subscription with no page live: the first renewal invoice is paid. */
function renewal(id: string): Record<string, unknown> {
  const invoiceId = `in_renew_${id}`;
  vendor.subscriptions.set(`sub_${id}`, subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: new Date(RENEWED.getTime() + 30 * DAY) }));
  const invoice = paidInvoiceDouble({ id: invoiceId, customer: `cus_${id}`, paidAt: RENEWED, renews: { from: PAID, to: RENEWED } });
  vendor.invoices.push(invoice);
  vi.setSystemTime(new Date(RENEWED.getTime() + 60 * 1000));
  return {
    id: `evt_paid_${invoiceId}`,
    type: "invoice.paid",
    data: { object: { ...invoice, parent: { type: "subscription_details", subscription_details: { subscription: `sub_${id}` } } } },
  };
}

/** The customer cancels at the period end on day 3. */
function cancelOnDay3(id: string): Record<string, unknown> {
  vi.setSystemTime(new Date(PAID.getTime() + 3 * DAY));
  return {
    id: `evt_cancel_${id}`,
    type: "customer.subscription.updated",
    data: { object: subscriptionDouble({ id: `sub_${id}`, customer: `cus_${id}`, periodEnd: RENEWED, cancelAtPeriodEnd: true }) },
  };
}

/** Delivers one event through the real route, runs what it handed to `after`, and answers its status. */
async function deliver(event: Record<string, unknown>): Promise<number> {
  vendor.event = event;
  const response = await POST(
    new Request("https://reachkit.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" }),
    undefined as never
  );
  for (const task of afterTasks.splice(0)) await task();
  return response.status;
}

function refundMails(): { to: string; text: string }[] {
  return mails.filter((mail) => mail.text.includes(copy("mail.account.renewal_refunded", { amount: "€49.00" })));
}

function refusedAlerts(): { to: string; text: string }[] {
  return mails.filter((mail) => mail.text.includes(copy("mail.ops.incident.refund-refused")));
}

/** One refund, recorded once in D4's ledger, and access ended at the cancel. */
async function expectD4RefundedOnce(id: string): Promise<void> {
  expect(vendor.refundsCreated).toEqual([expect.objectContaining({ idempotencyKey: `refund:in_first_${id}` })]);
  expect(state.refunds).toMatchObject([{ invoice_id: `in_first_${id}`, user_id: id }]);
  expect(vendor.cancelled).toEqual([`sub_${id}`]);
  expect(Date.parse(storedUser(state).paid_through)).toBeLessThanOrEqual(Date.now());
  expect(await hasActiveAccess(`site_${id}`)).toBe(false);
}

/** One refund keyed on the renewal, recorded once in D10's ledger, one mail, and access runs on. */
async function expectD10RefundedOnce(id: string): Promise<void> {
  expect(vendor.refundsCreated).toEqual([expect.objectContaining({ idempotencyKey: `refund:in_renew_${id}` })]);
  expect(state.renewalRefunds).toMatchObject([{ invoice_id: `in_renew_${id}`, user_id: id }]);
  expect(refundMails()).toEqual([expect.objectContaining({ to: `${id}@example.com` })]);
  expect(await hasActiveAccess(`site_${id}`)).toBe(true);
}

describe("a failure that will pass answers 500, and the redelivery refunds once", () => {
  it("d10 connection error → 500 → redelivery refunds once and mails once", async () => {
    customer("plumber");
    const event = renewal("plumber");
    vendor.refundError = stripeErrors.connection();

    expect(await deliver(event)).toBe(500);
    expect(state.renewalRefunds).toEqual([]);
    expect(mails).toEqual([]);

    vendor.refundError = null;
    expect(await deliver(event)).toBe(200);
    await expectD10RefundedOnce("plumber");
    expect(refusedAlerts()).toEqual([]);

    expect(await deliver(event)).toBe(200);
    expect(state.renewalRefunds).toHaveLength(1);
    expect(mails).toHaveLength(1);
  });

  it("d4 503 → 500 → redelivery refunds once", async () => {
    customer("scheduler");
    const event = cancelOnDay3("scheduler");
    vendor.refundError = stripeErrors.unavailable();

    expect(await deliver(event)).toBe(500);
    expect(state.refunds).toEqual([]);
    expect(vendor.cancelled).toEqual([]);
    expect(await hasActiveAccess("site_scheduler")).toBe(true);

    vendor.refundError = null;
    expect(await deliver(event)).toBe(200);
    await expectD4RefundedOnce("scheduler");

    expect(await deliver(event)).toBe(200);
    await expectD4RefundedOnce("scheduler");
    expect(refusedAlerts()).toEqual([]);
  });

  it("a 429 on the refund is retried the same way, and no incident is sent", async () => {
    customer("plumber");
    const event = renewal("plumber");
    vendor.refundError = stripeErrors.rateLimited();

    expect(await deliver(event)).toBe(500);
    vendor.refundError = null;
    expect(await deliver(event)).toBe(200);

    await expectD10RefundedOnce("plumber");
    expect(refusedAlerts()).toEqual([]);
  });
});

describe("a permanent refusal is final", () => {
  it("permanent refusal → 200 and one incident", async () => {
    customer("plumber");
    vendor.refundError = stripeErrors.disputed();

    expect(await deliver(renewal("plumber"))).toBe(200);

    expect(refusedAlerts()).toHaveLength(1);
    expect(refusedAlerts()[0]?.text).toContain("charge_disputed");
    expect(state.renewalRefunds).toEqual([]);
    expect(state.refunds).toEqual([]);
    expect(refundMails()).toEqual([]);
  });
});

describe("every store or transient vendor step inside a refund answers 500, and the redelivery repairs it", () => {
  it.each([
    ["the live count", () => { state.failHostingRead = true; }, () => { state.failHostingRead = false; }],
    ["the invoice list", () => { vendor.invoiceListError = stripeErrors.unavailable(); }, () => { vendor.invoiceListError = null; }],
    ["the renewal refund row", () => { state.failMethod = "recordRenewalRefund"; }, () => { state.failMethod = null; }],
  ] as const)("d10, %s", async (_, fail, heal) => {
    customer("scheduler");
    const event = renewal("scheduler");
    fail();

    expect(await deliver(event)).toBe(500);
    expect(state.renewalRefunds).toEqual([]);
    expect(mails).toEqual([]);

    heal();
    expect(await deliver(event)).toBe(200);
    await expectD10RefundedOnce("scheduler");
  });

  it.each([
    ["the earlier refunds", () => { state.failMethod = "refundsFor"; }, () => { state.failMethod = null; }],
    ["the invoice list", () => { vendor.invoiceListError = stripeErrors.connection(); }, () => { vendor.invoiceListError = null; }],
    ["the refund row", () => { state.failMethod = "recordRefund"; }, () => { state.failMethod = null; }],
    ["the immediate cancel", () => { vendor.cancelError = stripeErrors.unavailable(); }, () => { vendor.cancelError = null; }],
    ["the end of access", () => { state.failMethod = "stampCancelled"; }, () => { state.failMethod = null; }],
  ] as const)("d4, %s", async (_, fail, heal) => {
    customer("plumber");
    const event = cancelOnDay3("plumber");
    // Already mirrored, so the only `stampCancelled` left is the one that ends access.
    state.users[0] = { ...storedUser(state), cancelled_at: new Date().toISOString() };
    fail();

    expect(await deliver(event)).toBe(500);

    heal();
    expect(await deliver(event)).toBe(200);
    await expectD4RefundedOnce("plumber");
  });

  it("a mail vendor that fails after the refund is recorded answers 200, and a redelivery sends nothing", async () => {
    customer("plumber");
    const event = renewal("plumber");
    mailDown = true;

    expect(await deliver(event)).toBe(200);
    expect(state.renewalRefunds).toHaveLength(1);

    mailDown = false;
    expect(await deliver(event)).toBe(200);
    expect(refundMails()).toEqual([]);
    expect(vendor.refundsCreated).toHaveLength(1);
  });
});
