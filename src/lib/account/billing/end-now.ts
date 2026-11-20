// src/lib/account/billing/end-now.ts — BUILD §13
//
// Ending a subscription **at once**, which is a different act from
// cancelling and lives beside it rather than inside it.
//
// `cancel.ts` cuts nothing off now: REQ-076 criterion 3 keeps everything
// running to the paid-through date, and its discriminating test is that
// `hasActiveAccess` is still true afterwards. REQ-079 criterion 6 asks for
// the opposite and asks for it only once, when an account is deleted: "the
// subscription ends at once with no further charge and no remaining paid
// access". Folding the two into one function with a flag would put the
// customer-facing cancellation one boolean away from taking a paying
// customer's access away on the day they cancelled.
//
// Two writes, in this order: the vendor stops billing, then the stored gate
// moves. `paid_through = now()` is what makes `hasActiveAccess` false at
// once (the gate needs that column after now), and it is also what stops
// the hosted retention window ever beginning: REQ-076 criterion 10's window
// runs from the paid-through date, and REQ-079 criterion 6 ends serving at
// the moment of deletion instead, which `hostedServingState` reads from the
// tombstone and not from a second switch.
//
// **The vendor first.** A store write that landed before the vendor call
// failed would leave a customer with no access and a live subscription
// still charging them.
import { stripe, type Stripe } from "../stripe/client";
import { isTransient, redeliver } from "../stripe/transient";
import { freeSpotOnRefund } from "../offer/spots";
import { billingStore } from "./store";

export type EndSubscriptionNow =
  | { ok: true; endedAt: Date }
  /** `transient`: the vendor failure will pass, so a webhook caller fails for redelivery. */
  | { ok: false; reason: "store" | "vendor"; transient?: true };

export async function endSubscriptionNow(
  userId: string,
  now?: Date
): Promise<EndSubscriptionNow> {
  const at = now ?? new Date();
  const store = billingStore();

  const read = await store.account(userId);
  if (!read.ok || read.account === null) return { ok: false, reason: "store" };
  const account = read.account;

  // A subscription the vendor already reports cancelled has nothing left to stop.
  if (account.stripe_subscription_id !== null && account.plan_status !== "canceled") {
    try {
      await stripe().subscriptions.cancel(account.stripe_subscription_id);
    } catch (error) {
      console.warn(JSON.stringify({ event: "billing_end_now", outcome: "vendor" }));
      return isTransient(error) ? { ok: false, reason: "vendor", transient: true } : { ok: false, reason: "vendor" };
    }
  }

  // An account with no subscription still has its gate closed: there is
  // nothing at the vendor to stop, and paid access is what criterion 6 ends.
  const written = await store.writeSubscriptionFacts(userId, {
    stripe_subscription_id: account.stripe_subscription_id ?? "",
    paid_through: at,
    plan_status: "canceled",
    eventId: null,
  });
  if (!written.ok) return { ok: false, reason: "store" };

  const stamped = await store.stampCancelled(userId, at);
  if (!stamped.ok) return { ok: false, reason: "store" };

  return { ok: true, endedAt: at };
}

/** SPEC §3: a full refund or an opened dispute ends access and paid generation at once; a partial refund changes nothing. */
export async function onRefundOrDispute(event: Stripe.Event): Promise<{ ended: boolean }> {
  let charge: Stripe.Charge;
  if (event.type === "charge.refunded") {
    charge = event.data.object as Stripe.Charge;
    if (!charge.refunded) return { ended: false };
  } else {
    const named = (event.data.object as Stripe.Dispute).charge;
    try {
      charge = typeof named === "string" ? await stripe().charges.retrieve(named) : named;
    } catch (error) {
      // Only a passing failure is worth Stripe's redelivery; a charge Stripe cannot find is logged and answered 200.
      if (isTransient(error)) redeliver("dispute_charge");
      console.warn(JSON.stringify({ event: "billing_dispute_charge", outcome: "unreadable" }));
      return { ended: false };
    }
  }
  if (charge.customer === null) return { ended: false };

  const read = await billingStore().accountByStripeCustomer(typeof charge.customer === "string" ? charge.customer : charge.customer.id);
  if (!read.ok) redeliver("account");
  const account = read.account;
  // Before the already-ended check, so a redelivery finishes a free that failed.
  if (account !== null && event.type === "charge.refunded" && !(await freeSpotOnRefund(account.id, new Date(event.created * 1000)))) {
    redeliver("offer_spot");
  }
  // Already ended, so a redelivery calls Stripe for nothing and moves no date.
  if (account === null || (account.plan_status === "canceled" && new Date(account.paid_through).getTime() <= Date.now())) {
    return { ended: false };
  }

  const ended = await endSubscriptionNow(account.id);
  if (!ended.ok) redeliver(`end_now_${ended.reason}`);
  return { ended: true };
}
