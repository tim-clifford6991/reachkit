// BUILD §4.7 — the Server Functions behind the Billing card's three controls.
//
// REQ-097 criterion 1 puts the card, the invoices, the billing address, the
// VAT number and cancelling on **one** destination: Stripe's own billing
// surface. §4.7's three controls therefore all lead to the same place, and
// what this file does is mint the session that leads there.
//
// **Minted at the press, never on the render.** A portal session is
// short-lived. One made while Settings was being drawn would be a vendor
// round trip per page view and an address that had expired by the time
// anybody pressed it — which is why `provider.ts` deliberately does not
// call `portalLink` and why this is a Server Function rather than an `href`
// on the model.
//
// **This file exports one thing per control and nothing else.** A `"use
// server"` module may export only async functions, so the union, the arms
// and the map the panel calls all live in `./actions`, which both this file
// and the screen import.
//
// **Which account is acting.** `src/middleware.ts` has already refused this
// request unless it carried a session cookie, so a caller reaching here is
// signed in; *which* account it is, is #35's `currentSession()`, which does
// not exist yet. Until it does this uses the same fixture account
// `/api/setup` and `calendar/publishing-actions.ts` use — one stand-in,
// named once, not a third guess.
//
// **`@/lib/account/billing` and `@/lib/config/env` are imported inside the
// call, not at the top.** Both reach the environment the moment they are
// evaluated — billing through `@/lib/db`. This module is imported
// statically by a client component (that is how a Server Function gets its
// reference), so a top-level import would make merely *rendering* Settings
// require a full server environment, and would take the layout conformance
// build, the presentation sweeps and `next build`'s own page-data
// collection down with it. `provider.ts` records the same rule for the same
// reason.
"use server";

import { FIXTURE_USER_ID } from "@/app/(account)/setup/_setup/fixture";
import type { ActionOutcome } from "./actions";

function currentUserId(): string {
  return FIXTURE_USER_ID;
}

/** REQ-097 c1's `return_url`: the screen the customer pressed the control
 *  on. Absolute, because `portalLink` parses it and compares origins rather
 *  than matching a prefix — a relative path is not a URL and is refused. */
async function returnToSettings(): Promise<string> {
  const { env } = await import("@/lib/config/env");
  return new URL("/app/settings", env.NEXT_PUBLIC_APP_URL).toString();
}

/**
 * One portal session, or REQ-097 criterion 6's answer.
 *
 * Every one of `portalLink`'s refusals lands on the same arm, because
 * criterion 6 names them together — "Stripe unreachable, or a session
 * refused for any other reason". Which one it was is an operator's fact and
 * tells the customer nothing they can act on; what they are owed is that
 * billing cannot be reached, that they may try again, and one way to reach
 * a person.
 */
async function openPortal(): Promise<ActionOutcome> {
  try {
    const { portalLink } = await import("@/lib/account/billing");
    const link = await portalLink(currentUserId(), await returnToSettings());
    return link.ok ? { done: "elsewhere", href: link.url } : { done: "unreachable" };
  } catch {
    // No environment, or a module that could not be constructed at all.
    // Still criterion 6's state, and still nothing written anywhere.
    return { done: "unreachable" };
  }
}

/** §4.7's invoices link, and Update card with it — REQ-097 c1's "no separate
 *  control per item", so both are the one destination. */
export async function openBillingSurface(): Promise<ActionOutcome> {
  return openPortal();
}

/** §4.7's Cancel plan. Cancelling is done on Stripe's surface with
 *  `subscription_cancel` in `at_period_end` mode (`PORTAL_FEATURES`), which
 *  is REQ-076 criterion 3's "everything running until that date" — so this
 *  screen shows no cancellation control and no confirmation step of its
 *  own, only the way to the one that exists. */
export async function cancelPlan(): Promise<ActionOutcome> {
  return openPortal();
}

/**
 * REQ-076 criterion 6's resume — "before or after the paid-through date …
 * without contacting anyone".
 *
 * **Two paths, because they are two different things.** Before the date the
 * subscription still exists with `cancel_at_period_end` set, and un-setting
 * it is what Stripe's own portal offers; after it the subscription has
 * ended and the portal has nothing to restart, so `resumeSubscription()`
 * opens a new one against the customer Stripe still holds. Sending an
 * ended subscription to the portal would show the customer a surface with
 * no resume on it and leave criterion 6's promise unkept.
 *
 * The date is read here rather than passed in: what the screen rendered may
 * be minutes old, and the boundary this branches on is the one the store
 * holds now.
 */
export async function resumePlan(): Promise<ActionOutcome> {
  try {
    const { billingSummary, resumeSubscription } = await import("@/lib/account/billing");
    const read = await billingSummary(currentUserId());
    // A summary that cannot be read is not a reason to guess which path
    // this is. Criterion 6 is not served by resuming the wrong way.
    if (!read.ok) return { done: "unreachable" };
    if (read.summary.paidThrough.getTime() > Date.now()) return openPortal();

    const resumed = await resumeSubscription(currentUserId());
    return resumed.ok ? { done: "here" } : { done: "unreachable" };
  } catch {
    return { done: "unreachable" };
  }
}
