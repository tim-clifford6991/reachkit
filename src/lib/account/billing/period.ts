// src/lib/account/billing/period.ts — BUILD §13
//
// One reading of one vendor field, in one place: the instant a subscription
// is paid through.
//
// **`current_period_end` is on the subscription's items, not on the
// subscription.** It moved there in the vendor's API, and the shape is easy
// to get wrong in a way that type-checks nowhere and fails at runtime on a
// live subscription only. Reading it here, once, is what keeps
// `openSubscription`, `onSubscriptionEvent`, `cancelSubscription` and
// `resumeSubscription` from each holding their own version of that reading.
//
// There is one item on every subscription this product creates (one plan,
// quantity one — `src/lib/account/checkout/params.ts`), so the latest item
// period end is that item's. `Math.max` over the items rather than
// `items.data[0]` because a subscription that somehow carried two would be
// paid through the later of them, and the gate must never end access early.
import type { Stripe } from "../stripe/client";

/** The instant this subscription is paid through, or `null` where the
 *  vendor reported no period at all — which is not a date to guess at. */
export function paidThroughOf(subscription: Stripe.Subscription): Date | null {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((end): end is number => typeof end === "number");
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000);
}
