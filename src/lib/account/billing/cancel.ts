// src/lib/account/billing/cancel.ts — BUILD §13
//
// Cancelling cuts nothing off now.
//
// REQ-076 criterion 3: "the screen states the exact date their access ends,
// and measurement, generation and publishing continue unchanged until that
// date". So this function cancels **at period end**, stamps `cancelled_at`,
// and leaves `paid_through` exactly where it was. The discriminating test
// is the one that would look redundant: after cancelling,
// `hasActiveAccess` is still true.
//
// **`paid_through` needs no arithmetic.** `cancel_at_period_end` leaves the
// subscription's own period end alone, so the date the customer is told is
// the column that was already there. BP-060 carried this as an open
// `rests-on` row — "settled by one cancellation in test mode" — and it is
// still open: nothing here computes an end date, so if the vendor's
// semantics turn out otherwise, the value that is wrong is the vendor's and
// this file has invented nothing on top of it.
//
// **Nothing on a ReachKit screen calls this.** REQ-097 criterion 1: the
// product "presents no field, form, stepper, cancellation control,
// confirmation step or consequence screen" for cancelling — the customer
// cancels on Stripe's own portal, and the `customer.subscription.updated`
// that comes back is what stamps `cancelled_at` (`events.ts`). This
// function is the module's declared interface and the path a support
// action would take; it is deliberately not wired to a control.
//
// `hostedServingEndsAt` is returned because REQ-076 criterion 7 requires
// the customer be told the day their hosted pages stop being served — where
// they have any. `null` where they have none: a customer with no hosted
// page has no such day, and stating one would be stating a fact about
// nothing.
import { HOSTED_RETENTION_DAYS } from "@/lib/config/constants";
import { stripe } from "../stripe/client";
import { paidThroughOf } from "./period";
import { billingStore } from "./store";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CancelResult =
  | { ok: true; accessEndsAt: Date; hostedServingEndsAt: Date | null }
  | { ok: false; reason: "already_cancelled" | "no_subscription" | "store" | "vendor" };

export async function cancelSubscription(userId: string): Promise<CancelResult> {
  const store = billingStore();

  const read = await store.account(userId);
  if (!read.ok) return { ok: false, reason: "store" };
  const account = read.account;
  if (account === null) return { ok: false, reason: "store" };

  // A second cancel is not a failure and not a second write: the plan is
  // already going to end on the day it was going to end.
  if (account.cancelled_at !== null) return { ok: false, reason: "already_cancelled" };
  if (account.stripe_subscription_id === null) return { ok: false, reason: "no_subscription" };

  let subscription;
  try {
    subscription = await stripe().subscriptions.update(account.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch {
    console.warn(JSON.stringify({ event: "billing_cancel", outcome: "vendor" }));
    return { ok: false, reason: "vendor" };
  }

  const stamped = await store.stampCancelled(userId, new Date());
  if (!stamped.ok) return { ok: false, reason: "store" };

  // The date access ends is the stored gate, not the vendor's answer to
  // this call. The two agree; the stored one is the one every loop reads,
  // so it is the one the customer is told about.
  const accessEndsAt = new Date(account.paid_through);

  // A vendor period end that disagrees with the column is recorded rather
  // than silently preferred: `onSubscriptionEvent` is the only writer of
  // `paid_through`, and a cancel that moved it would be a second one.
  const vendorEnd = paidThroughOf(subscription);
  if (vendorEnd !== null && vendorEnd.getTime() !== accessEndsAt.getTime()) {
    console.warn(
      JSON.stringify({
        event: "billing_cancel",
        outcome: "period_end_disagrees",
        because: "paid_through is the gate (ADR-050); the vendor's own event advances it, never this call",
      })
    );
  }

  const sites = await store.hostingForAccount(userId);
  const hasHostedPages = sites.ok && sites.sites.some((site) => site.hasHostedPages);

  return {
    ok: true,
    accessEndsAt,
    hostedServingEndsAt: hasHostedPages
      ? new Date(accessEndsAt.getTime() + HOSTED_RETENTION_DAYS * MS_PER_DAY)
      : null,
  };
}
