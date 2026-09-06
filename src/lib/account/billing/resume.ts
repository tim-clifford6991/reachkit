// src/lib/account/billing/resume.ts — BUILD §13
//
// Coming back, before or after the date, without asking anyone.
//
// REQ-076 criterion 6: "Given a cancelled customer changes their mind, when
// they resume — **before or after the paid-through date** — then they can
// do so themselves without contacting anyone, onto the same domain,
// category and competitor set they left with."
//
// Two arms, because they are two different vendor operations:
//   · **before** the date the subscription is still there with
//     `cancel_at_period_end` set — un-setting it is the whole of resuming,
//     and the customer is asked for nothing;
//   · **after** it the subscription has ended, and a new one is created
//     against the **existing customer**, whose payment method Stripe still
//     holds. No card is asked for, which is REQ-097 criterion 3's "ReachKit
//     presents no card field, no payment form and no billing form of its
//     own at any point on that path".
//
// **`sites` is not touched.** Not the domain, not the category, not the
// competitors, not the mode — c6's promise is that the customer returns to
// what they left, and the way to keep that promise is to write nothing.
// The only `sites` write here is clearing the hosted-retention clock, which
// is not a setting the customer chose: it is a countdown that started
// because they left, and it stops because they came back.
//
// Clearing the window clears both notice stamps with it. A customer who
// resumed was told a day that is no longer going to happen; if they leave
// again they are owed both notices afresh, about the new day.
import { env } from "@/lib/config/env";
import { stripe } from "../stripe/client";
import { paidThroughOf } from "./period";
import { recordedStatus } from "./status";
import { billingStore } from "./store";

export type ResumeResult =
  | { ok: true; paidThrough: Date }
  | { ok: false; reason: "not_cancelled" | "no_customer" | "store" | "vendor" };

export async function resumeSubscription(userId: string): Promise<ResumeResult> {
  const store = billingStore();

  const read = await store.account(userId);
  if (!read.ok) return { ok: false, reason: "store" };
  const account = read.account;
  if (account === null) return { ok: false, reason: "store" };

  // Resuming something that was never cancelled is not a resume. It is
  // reported rather than treated as a no-op success, because a screen that
  // offered the control was reading a different state from this row.
  if (account.cancelled_at === null) return { ok: false, reason: "not_cancelled" };
  if (account.stripe_customer_id === null) return { ok: false, reason: "no_customer" };

  let subscription;
  try {
    const existing =
      account.stripe_subscription_id === null
        ? null
        : await stripe().subscriptions.retrieve(account.stripe_subscription_id);

    subscription =
      existing !== null && existing.status !== "canceled"
        ? // Still inside the paid period: un-cancelling is the whole of it.
          await stripe().subscriptions.update(existing.id, { cancel_at_period_end: false })
        : // Past the date: a new subscription on the same customer, at the
          // same one price. `STRIPE_PRICE_ID` is the price every surface
          // sells (BUILD §13, ADR-052) — there is no second price to pick.
          await stripe().subscriptions.create({
            customer: account.stripe_customer_id,
            items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
          });
  } catch {
    console.warn(JSON.stringify({ event: "billing_resume", outcome: "vendor" }));
    return { ok: false, reason: "vendor" };
  }

  const paidThrough = paidThroughOf(subscription);
  if (paidThrough === null) {
    // A subscription with no period is a subscription this module cannot
    // date. Better to say so than to invent a month.
    console.warn(JSON.stringify({ event: "billing_resume", outcome: "no_period" }));
    return { ok: false, reason: "vendor" };
  }

  const written = await store.writeSubscriptionFacts(userId, {
    stripe_subscription_id: subscription.id,
    paid_through: paidThrough,
    plan_status: recordedStatus(subscription.status) ?? account.plan_status,
    // Resume is not a vendor event and carries no event id. The column
    // records the last *event* applied, and a replayed event must still be
    // recognised after a resume, so the id already there is left alone.
    eventId: null,
  });
  if (!written.ok) return { ok: false, reason: "store" };

  const cleared = await store.stampCancelled(userId, null);
  if (!cleared.ok) return { ok: false, reason: "store" };

  // The countdown stops on every site the account owns. A site that never
  // had one is unaffected — clearing a null is a null.
  const sites = await store.hostingForAccount(userId);
  if (sites.ok) {
    for (const site of sites.sites) {
      if (site.hosted_serving_ends_at === null) continue;
      await store.stampHostedServingEndsAt(site.id, null);
    }
  }

  return { ok: true, paidThrough };
}
