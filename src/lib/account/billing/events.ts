// src/lib/account/billing/events.ts — BUILD §13
//
// The vendor's own account of a subscription's life, and the one column it
// moves.
//
// `src/lib/account/provisioning/events.ts` routes five event types here —
// `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`
// and `invoice.payment_failed`. Each of them says the same two things about
// one subscription: how far it is paid, and what the vendor calls it. This
// module writes those two and **nothing else**.
//
// **It invents no behaviour for a failed renewal.** REQ-076's non-goal
// deferred chargebacks and `past_due` by owner ruling. Its deferral of
// refunds is superseded for two cases only (`refund.ts`): D4's cancel in the
// first 14 days, reached from the two cancellation events
// (`docs/spec/decisions/2026-10-20-1699.md`), and D10's first renewal with no
// page live, reached from `invoice.paid`
// (`docs/spec/decisions/2026-10-24-1592.md`). So
// `invoice.payment_failed` records the status and
// returns: no mail, no retry, no dunning, no downgrade, no revocation.
// REQ-097 criterion 4 says the same thing from the customer's side:
// ReachKit sends no mail on a billing event at all. `tests/account/billing/
// events.test.ts` fails if any behaviour is added to that arm.
//
// **A failed renewal does not take access away either.** ADR-050 is the
// whole gate, and REQ-076 c8 spells the consequence: access holds "whether
// or not its latest renewal was paid". The customer keeps what they have
// paid for until `paid_through` passes, and a bounced card does not move
// that date because the vendor never advanced it.
//
// **`paid_through` never goes backwards from an event.** Vendor events are
// not ordered — a redelivery of last month's `invoice.paid` can arrive
// after this month's — and an event that moved the gate backwards would
// take access from somebody who has it. The only writer that may move it
// back is deletion (REQ-079 c6), which is not an event and not this file.
//
// **Idempotent on the event id.** `users.last_subscription_event_id` is the
// durable half: a second delivery of an event this row has already seen
// changes nothing and says so. The other half is the shape of the write —
// every column here is set to a value, never incremented — so even an
// event that slipped past the id check would leave the same row.
import { stripe, type Stripe } from "../stripe/client";
import { isTransient, redeliver } from "../stripe/transient";
import { paidThroughOf } from "./period";
import { refundFirstFortnight, refundFirstRenewal } from "./refund";
import { recordedStatus } from "./status";
import { billingStore, type BillingRow } from "./store";

export type SubscriptionEventOutcome =
  | { applied: true }
  /** Received, understood, and correctly nothing: a replay, an event about
   *  a subscription no account here owns, or one carrying no period to
   *  advance to. None of the three is a failure. */
  | { applied: false; because: "replay" | "no_account" | "no_period" | "vendor" };

/** The subscription an event is about. `customer.subscription.*` carries
 *  the subscription itself; the two invoice events carry an invoice whose
 *  parent names it. Both are resolved to a full subscription object, so the
 *  period end is read from one shape in one place (`period.ts`). */
async function subscriptionOf(event: Stripe.Event): Promise<Stripe.Subscription | null> {
  if (event.type.startsWith("customer.subscription.")) {
    return event.data.object as Stripe.Subscription;
  }

  const invoice = event.data.object as Stripe.Invoice;
  const parent = invoice.parent;
  const details = parent?.type === "subscription_details" ? parent.subscription_details : null;
  const subscription = details?.subscription ?? null;
  if (subscription === null) return null;
  if (typeof subscription !== "string") return subscription;

  try {
    return await stripe().subscriptions.retrieve(subscription);
  } catch (error) {
    if (isTransient(error)) redeliver("subscription");
    return null;
  }
}

/** The account this subscription belongs to. By subscription id first —
 *  the direct link — and by customer id second, which is the one that works
 *  for the very first event, before any row names the subscription. */
async function accountOf(subscription: Stripe.Subscription): Promise<BillingRow | null> {
  const store = billingStore();

  const bySubscription = await store.accountBySubscription(subscription.id);
  if (!bySubscription.ok) redeliver("account");
  if (bySubscription.account !== null) return bySubscription.account;

  const customer = subscription.customer;
  const customerId = typeof customer === "string" ? customer : customer.id;
  const byCustomer = await store.accountByStripeCustomer(customerId);
  if (!byCustomer.ok) redeliver("account");
  return byCustomer.account;
}

export async function onSubscriptionEvent(event: Stripe.Event): Promise<SubscriptionEventOutcome> {
  const subscription = await subscriptionOf(event);
  if (subscription === null) return { applied: false, because: "vendor" };

  const account = await accountOf(subscription);
  if (account === null) {
    // An event for a customer this database does not know. Not an error:
    // `checkout.session.completed` may simply not have been processed yet,
    // and provisioning stamps the first period end itself when it is
    // (`openSubscription`). Nothing is retried and nothing is stored.
    return { applied: false, because: "no_account" };
  }

  if (account.last_subscription_event_id === event.id) {
    // A redelivery finishes what a failed first delivery left after its event id was written.
    await mirrorCancellation(account, subscription);
    await refundOn(event, account, subscription);
    return { applied: false, because: "replay" };
  }

  const vendorPaidThrough = paidThroughOf(subscription);
  if (vendorPaidThrough === null) return { applied: false, because: "no_period" };

  // Never backwards. An out-of-order redelivery records the status it
  // carries and leaves the gate where the later event already put it.
  const stored = new Date(account.paid_through);
  const paidThrough =
    vendorPaidThrough.getTime() > stored.getTime() ? vendorPaidThrough : stored;

  const written = await billingStore().writeSubscriptionFacts(account.id, {
    stripe_subscription_id: subscription.id,
    paid_through: paidThrough,
    plan_status: recordedStatus(subscription.status) ?? account.plan_status,
    eventId: event.id,
  });
  if (!written.ok) redeliver("subscription_facts");

  await mirrorCancellation(account, subscription);
  await refundOn(event, account, subscription);
  return { applied: true };
}

/** The vendor's own record of the cancellation, mirrored onto the column
 *  the Settings card reads. It is a record and not a gate: a cancelled
 *  account keeps access until `paid_through` passes (ADR-050, REQ-076 c3). */
async function mirrorCancellation(account: BillingRow, subscription: Stripe.Subscription): Promise<void> {
  const cancelledNow = subscription.cancel_at_period_end || subscription.status === "canceled";
  const cancelledHere = account.cancelled_at !== null;
  if (cancelledNow === cancelledHere) return;
  const stamped = await billingStore().stampCancelled(account.id, cancelledNow ? new Date() : null);
  if (!stamped.ok) redeliver("cancelled_at");
}

const CANCEL_EVENTS: ReadonlySet<string> = new Set([
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** D4's refund on the two cancellation events, D10's on a paid invoice. A
 *  failure that will pass throws, so Stripe redelivers the event. */
async function refundOn(event: Stripe.Event, account: BillingRow, subscription: Stripe.Subscription): Promise<void> {
  if (CANCEL_EVENTS.has(event.type)) await refundFirstFortnight(account.id, subscription);
  else if (event.type === "invoice.paid") await refundFirstRenewal(account, event.data.object as Stripe.Invoice);
}

/** REQ-024 / §13 — the first period end, stamped by provisioning.
 *
 *  Called once, from `provisionFromPayment`, with the completed session's
 *  own subscription. It exists because the two deliveries are not ordered:
 *  `customer.subscription.created` can arrive before the account it belongs
 *  to has been opened, and `onSubscriptionEvent` correctly does nothing
 *  with it. Without this, an account opened in that order would sit on the
 *  column's default until its first renewal a month later — a paying
 *  customer with no access.
 *
 *  It writes the same two columns `onSubscriptionEvent` writes, through the
 *  same store method, and carries no event id: it is not an event. */
export async function openSubscription(a: {
  userId: string;
  subscriptionId: string;
}): Promise<{ ok: boolean }> {
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe().subscriptions.retrieve(a.subscriptionId);
  } catch {
    console.warn(JSON.stringify({ event: "billing_open_subscription", outcome: "vendor" }));
    return { ok: false };
  }

  const paidThrough = paidThroughOf(subscription);
  if (paidThrough === null) {
    console.warn(JSON.stringify({ event: "billing_open_subscription", outcome: "no_period" }));
    return { ok: false };
  }

  const written = await billingStore().writeSubscriptionFacts(a.userId, {
    stripe_subscription_id: subscription.id,
    paid_through: paidThrough,
    plan_status: recordedStatus(subscription.status) ?? "active",
    eventId: null,
  });
  return { ok: written.ok };
}
