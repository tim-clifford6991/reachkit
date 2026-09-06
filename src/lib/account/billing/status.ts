// src/lib/account/billing/status.ts — BUILD §13
//
// The vendor's subscription status, mapped onto the three words §10's
// `users.plan_status` check constraint admits.
//
// **This is a record and nothing else** (ADR-050). No gate reads
// `plan_status`; the map exists because the column has a check constraint
// and the vendor has more statuses than three, so a write of the vendor's
// own word would fail the constraint and lose the row's other columns with
// it.
//
// It is written as a total map over the vendor's union rather than a switch
// with a default arm: a status the vendor adds tomorrow lands on
// `undefined` and is recorded as what we last knew, instead of being
// silently filed under one of the three by a fallback nobody chose.
//
// **Nothing branches on the result.** REQ-076's non-goal is explicit that
// refunds, chargebacks and a failed renewal (`past_due`) are deferred by
// owner ruling, and `onSubscriptionEvent` invents no behaviour for any of
// them: it records the status and returns.
import type { Stripe } from "../stripe/client";

/** §10, verbatim: `plan_status(active/past_due/canceled)`. The American
 *  spelling is the schema's. */
export type PlanStatusRecord = "active" | "past_due" | "canceled";

const RECORDED: Readonly<Partial<Record<Stripe.Subscription.Status, PlanStatusRecord>>> =
  Object.freeze({
    active: "active",
    trialing: "active",
    paused: "active",
    incomplete: "past_due",
    incomplete_expired: "past_due",
    past_due: "past_due",
    unpaid: "past_due",
    canceled: "canceled",
  });

/** What to record for a vendor status. `null` where the vendor said
 *  something this schema has no word for — the caller leaves the column as
 *  it was, because "we do not know what this means" is not one of the three
 *  things the column may say. */
export function recordedStatus(status: Stripe.Subscription.Status): PlanStatusRecord | null {
  return RECORDED[status] ?? null;
}
