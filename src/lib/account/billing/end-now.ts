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
// once (ADR-050 — the gate is that column alone), and it is also what stops
// the hosted retention window ever beginning: REQ-076 criterion 10's window
// runs from the paid-through date, and REQ-079 criterion 6 ends serving at
// the moment of deletion instead, which `hostedServingState` reads from the
// tombstone and not from a second switch.
//
// **The vendor first.** A store write that landed before the vendor call
// failed would leave a customer with no access and a live subscription
// still charging them.
import { stripe } from "../stripe/client";
import { billingStore } from "./store";

export type EndSubscriptionNow =
  | { ok: true; endedAt: Date }
  | { ok: false; reason: "store" | "vendor" };

export async function endSubscriptionNow(
  userId: string,
  now?: Date
): Promise<EndSubscriptionNow> {
  const at = now ?? new Date();
  const store = billingStore();

  const read = await store.account(userId);
  if (!read.ok || read.account === null) return { ok: false, reason: "store" };
  const account = read.account;

  if (account.stripe_subscription_id !== null) {
    try {
      await stripe().subscriptions.cancel(account.stripe_subscription_id);
    } catch {
      console.warn(JSON.stringify({ event: "billing_end_now", outcome: "vendor" }));
      return { ok: false, reason: "vendor" };
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
