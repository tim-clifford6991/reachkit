// src/lib/account/billing/refund.ts — BUILD §13
//
// Owner D4 (2026-10-19): a cancel within 14 days of the first payment
// refunds that payment in full, by itself, once per web address. The
// decision is `docs/spec/decisions/2026-10-20-1699.md`.
//
// The refund comes first and access ends only after it landed, so a vendor
// that refuses leaves the customer exactly where they were. Nothing here
// throws: the webhook still answers 200, and the next delivery tries again.
// Hosted pages are untouched: they follow the 30-day path from the new
// paid-through date like any other ended account.
//
// Owner D10 adds the first-renewal refund below (`2026-10-24-1592.md`): it
// keeps access and has its own ledger, so it never touches D4's.
import { after } from "next/server";
import { parseDomain } from "@/lib/scan/domain";
import { reportIncident } from "@/lib/mail/ops/incident";
import { sendEmail } from "@/lib/mail/send";
import { formatMailLongDate, formatMailMoney } from "@/lib/mail/blocks/format";
import { buildRenewalRefunded } from "@/lib/mail/templates/account";
import { stripe, type Stripe } from "../stripe/client";
import { endSubscriptionNow } from "./end-now";
import { paidThroughOf } from "./period";
import { billingStore, type BillingRow, type RefundRow } from "./store";

export const REFUND_WINDOW_DAYS = 14;

const WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type RefundOutcome =
  | "refunded"
  | "ended"
  | "not_cancelled"
  | "outside_window"
  | "refunded_before"
  | "store"
  | "vendor";

function log(fields: Record<string, string>): void {
  console.warn(JSON.stringify({ event: "billing_refund", ...fields }));
}

/** The canonical domains of every site the account owns: the "web address"
 *  D4 counts, so a second account for the same site is the same address. */
export async function accountDomains(userId: string): Promise<string[] | null> {
  const read = await billingStore().siteDomains(userId);
  if (!read.ok) return null;
  const domains = new Set<string>();
  for (const raw of read.domains) {
    const parsed = parseDomain(raw);
    if (parsed.ok) domains.add(parsed.domain);
  }
  return [...domains];
}

/** Every refund already made to this account or to its web addresses. */
export async function earlierRefunds(userId: string): Promise<readonly RefundRow[] | null> {
  const domains = await accountDomains(userId);
  if (domains === null) return null;
  const read = await billingStore().refundsFor(userId, domains);
  return read.ok ? read.refunds : null;
}

function paidAt(invoice: Stripe.Invoice): number {
  return (invoice.status_transitions.paid_at ?? invoice.created) * 1000;
}

/** The customer's first paid invoice. More than one page of paid invoices
 *  means the first payment is long past, so it answers none. */
async function firstPaidInvoice(customerId: string): Promise<Stripe.Invoice | null> {
  const page = await stripe().invoices.list({
    customer: customerId,
    status: "paid",
    limit: 100,
    expand: ["data.payments"],
  });
  if (page.has_more) return null;
  let first: Stripe.Invoice | null = null;
  for (const invoice of page.data) {
    if (first === null || paidAt(invoice) < paidAt(first)) first = invoice;
  }
  return first;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : value.id;
}

/** What paid the invoice, in the form `refunds.create` takes. */
function paymentOf(invoice: Stripe.Invoice): { payment_intent: string } | { charge: string } | null {
  for (const entry of invoice.payments?.data ?? []) {
    if (entry.status !== "paid") continue;
    const intent = idOf(entry.payment.payment_intent);
    if (intent !== null) return { payment_intent: intent };
    const charge = idOf(entry.payment.charge);
    if (charge !== null) return { charge };
  }
  return null;
}

function alreadyRefunded(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "charge_already_refunded";
}

function stripeCodeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "unknown";
}

/** Refunds the first payment when this cancellation falls inside its first
 *  14 days and the web address has had no refund. */
export async function refundFirstFortnight(
  userId: string,
  subscription: Stripe.Subscription,
  now: Date = new Date()
): Promise<RefundOutcome> {
  if (!subscription.cancel_at_period_end && subscription.status !== "canceled") return "not_cancelled";

  const read = await billingStore().account(userId);
  if (!read.ok || read.account === null) return "store";
  const account = read.account;

  const earlier = await earlierRefunds(userId);
  if (earlier === null) return "store";
  if (earlier.some((refund) => refund.user_id === userId && refund.subscription_id === subscription.id)) {
    // Refunded by an earlier delivery whose end of access did not land.
    if (new Date(account.paid_through).getTime() <= now.getTime()) return "refunded_before";
    const ended = await endSubscriptionNow(userId, now);
    return ended.ok ? "ended" : ended.reason;
  }
  if (earlier.length > 0) return "refunded_before";

  const customerId = idOf(subscription.customer);
  if (customerId === null) return "vendor";
  let invoice: Stripe.Invoice | null;
  try {
    invoice = await firstPaidInvoice(customerId);
  } catch {
    log({ outcome: "vendor", step: "invoices" });
    return "vendor";
  }
  if (invoice === null || invoice.amount_paid <= 0) return "outside_window";

  // Measured at the cancel, so a retry on day 15 of a day-13 cancel still refunds.
  const cancelledAt = account.cancelled_at === null ? now.getTime() : Date.parse(account.cancelled_at);
  if (cancelledAt - paidAt(invoice) > WINDOW_MS) return "outside_window";

  const invoiceId = invoice.id;
  if (invoiceId === undefined) return "vendor";
  const payment = paymentOf(invoice);
  if (payment === null) {
    log({ outcome: "no_payment", invoice: invoiceId });
    return "vendor";
  }

  try {
    await stripe().refunds.create(
      { ...payment, reason: "requested_by_customer", metadata: { invoice: invoiceId } },
      { idempotencyKey: `refund:${invoiceId}` }
    );
  } catch (error) {
    if (!alreadyRefunded(error)) {
      log({ outcome: "vendor", invoice: invoiceId });
      // Stripe does not redeliver a 200, so the owner is told after the response; `after` keeps a serverless invocation alive for it.
      const code = stripeCodeOf(error);
      after(() => reportIncident({ occasion: "refund-refused", invoiceId, userId, code }));
      return "vendor";
    }
  }

  const domains = (await accountDomains(userId)) ?? [];
  const recorded = await billingStore().recordRefund({ invoiceId, userId, subscriptionId: subscription.id, domains, at: now });
  if (!recorded.ok) {
    log({ outcome: "store", invoice: invoiceId });
    return "store";
  }

  const ended = await endSubscriptionNow(userId, now);
  if (!ended.ok) {
    log({ outcome: `end_${ended.reason}`, invoice: invoiceId });
    return ended.reason;
  }
  return "refunded";
}

/** The day the refunded plan renews or ends, in the site's zone; `null` where the subscription says neither, so no day is invented. */
async function nextDayOf(userId: string, paid: Stripe.Invoice, invoiceId: string): Promise<Parameters<typeof buildRenewalRefunded>[0]["next"]> {
  const details = paid.parent?.type === "subscription_details" ? paid.parent.subscription_details : null;
  const subscriptionId = idOf(details?.subscription);
  if (subscriptionId === null) return null;
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe().subscriptions.retrieve(subscriptionId);
  } catch {
    log({ outcome: "subscription_unread", invoice: invoiceId });
    return null;
  }
  const ending = subscription.cancel_at_period_end || subscription.status === "canceled";
  if (!ending && subscription.status !== "active") return null;
  const end = paidThroughOf(subscription);
  if (end === null) return null;
  const zone = await billingStore().siteZone(userId);
  return { kind: ending ? "ending" : "renewing", date: formatMailLongDate(end, zone.ok ? zone.timezone : null) };
}

export type RenewalRefundOutcome = "refunded" | "not_first_renewal" | "went_live" | "refunded_before" | "store" | "vendor";

/** Owner D10: the first renewal is refunded, and access runs on, when no
 *  page went live in the period that renewal closes. */
export async function refundFirstRenewal(account: BillingRow, paid: Stripe.Invoice): Promise<RenewalRefundOutcome> {
  if (paid.billing_reason !== "subscription_cycle" || paid.amount_paid <= 0) return "not_first_renewal";
  const customerId = idOf(paid.customer);
  const invoiceId = paid.id;
  if (customerId === null || invoiceId === undefined) return "vendor";

  let page: Stripe.ApiList<Stripe.Invoice>;
  try {
    page = await stripe().invoices.list({ customer: customerId, status: "paid", limit: 100, expand: ["data.payments"] });
  } catch {
    log({ outcome: "vendor", step: "invoices", invoice: invoiceId });
    return "vendor";
  }
  // More than a page of paid invoices is long past a first renewal.
  if (page.has_more) return "not_first_renewal";
  const renewals = page.data.filter((invoice) => invoice.billing_reason === "subscription_cycle");
  const invoice = renewals.find((candidate) => candidate.id === invoiceId);
  if (invoice === undefined) return "vendor";
  if (renewals.some((other) => other.id !== invoiceId && paidAt(other) <= paidAt(invoice))) return "not_first_renewal";

  // A subscription invoice's own period looks back one period: the first month.
  const live = await billingStore().wentLive(account.id, new Date(invoice.period_start * 1000), new Date(invoice.period_end * 1000));
  if (!live.ok) return "store";
  if (live.live) return "went_live";

  const payment = paymentOf(invoice);
  if (payment === null) {
    log({ outcome: "no_payment", invoice: invoiceId });
    return "vendor";
  }
  try {
    await stripe().refunds.create(
      { ...payment, reason: "requested_by_customer", metadata: { invoice: invoiceId } },
      { idempotencyKey: `refund:${invoiceId}` }
    );
  } catch (error) {
    if (!alreadyRefunded(error)) {
      log({ outcome: "vendor", invoice: invoiceId });
      const code = stripeCodeOf(error);
      after(() => reportIncident({ occasion: "refund-refused", invoiceId, userId: account.id, code }));
      return "vendor";
    }
  }

  const recorded = await billingStore().recordRenewalRefund({ invoiceId, userId: account.id, at: new Date() });
  if (!recorded.ok) {
    log({ outcome: "store", invoice: invoiceId });
    return "store";
  }
  // Only the delivery that recorded the refund tells the customer, so a re-delivery mails nothing.
  if (!recorded.inserted) return "refunded_before";
  const mail = buildRenewalRefunded({
    amount: formatMailMoney(invoice.amount_paid, invoice.currency),
    next: await nextDayOf(account.id, paid, invoiceId),
  });
  const sent = await sendEmail({ kind: "account", to: account.email, subject: mail.subject, blocks: mail.blocks });
  if (!sent.sent) log({ outcome: `mail_${sent.reason}`, invoice: invoiceId });
  return "refunded";
}
