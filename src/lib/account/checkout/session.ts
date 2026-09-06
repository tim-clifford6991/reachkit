// src/lib/account/checkout/session.ts — BUILD §13
//
// The one Checkout Session the product opens.
//
// §13: "Stripe Checkout from the report (scan id in metadata) or any price
// surface (scanless — no fabricated scan id)." Both surfaces build the
// *same* session: `CHECKOUT_PARAMS` is one object, and the only difference
// between a report purchase and a scanless one is a metadata entry that is
// present or absent. A `pricing` origin cannot carry a scan id because
// `CheckoutOrigin`'s scanless arm has no field to put one in, and this file
// writes `metadata.scanId` only from what `resolveOrigin` read off a real
// scan row.
//
// **This function takes no session and reads none.** REQ-020 criterion 1:
// "the next thing asked of them is payment — no account creation, no
// password, no questionnaire and no product configuration is presented
// first." An account is created by the payment, in `provisionFromPayment`,
// never here.
//
// **It writes no row.** REQ-020 criterion 2: a founder who leaves checkout
// without paying has no account, no site and no subscription — which is
// true here by construction, because nothing on this path touches a table.
// The store is read for the scan's status and nothing else.
//
// **No VAT registry is consulted, here or anywhere in this module.**
// REQ-022 criterion 7 — no check against VIES or any other registry stands
// between a buyer and their purchase. `tests/account/checkout/no-vies.test.ts`
// asserts it over the whole directory.
import { stripe, type Stripe } from "../stripe/client";
import { checkoutParams, type CheckoutParams } from "./params";
import { resolveOrigin, type CheckoutOrigin } from "./origin";
import { checkoutEvent } from "./redaction";
import { checkReturnTo } from "./return-to";

export type { CheckoutOrigin } from "./origin";

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; reason: "origin_scan_incomplete" | "return_to_not_ours" | "vendor" };

/** `CHECKOUT_PARAMS` frozen, as the vendor SDK's mutable parameter type.
 *  A copy, never a mutation: the asserted object stays frozen, and the two
 *  arrays are re-materialised because the SDK's signature wants arrays it
 *  could write to. Nothing is added, dropped or renamed here —
 *  `params.test.ts` asserts the key set on the frozen original and this
 *  spreads it whole. */
function toVendorParams(p: CheckoutParams): Stripe.Checkout.SessionCreateParams {
  return { ...p, line_items: [...p.line_items], custom_fields: [...p.custom_fields] };
}

/** What Stripe is told to come back to. Both are derived from the one
 *  allow-listed `returnTo`, so a cancelled checkout returns the buyer
 *  exactly where they were reading. */
function returnUrls(returnTo: URL): { success_url: string; cancel_url: string } {
  const success = new URL(returnTo.href);
  success.searchParams.set("checkout", "complete");
  return { success_url: success.href, cancel_url: returnTo.href };
}

/**
 * Begins Stripe Checkout for `origin`, returning the URL to send the buyer
 * to. `returnTo` is an absolute ReachKit URL, allow-listed against
 * `NEXT_PUBLIC_APP_URL`.
 */
export async function createCheckoutSession(a: {
  origin: CheckoutOrigin;
  returnTo: string;
}): Promise<CheckoutResult> {
  // The address is checked first: a refused return address must not cost a
  // database read, and must certainly not reach the vendor.
  const returnTo = checkReturnTo(a.returnTo);
  if (!returnTo.ok) {
    checkoutEvent({ sessionId: "", originKind: a.origin.kind, outcome: returnTo.reason });
    return { ok: false, reason: returnTo.reason };
  }

  const resolved = await resolveOrigin(a.origin);
  if (!resolved.ok) {
    checkoutEvent({ sessionId: "", originKind: a.origin.kind, outcome: resolved.reason });
    return { ok: false, reason: resolved.reason };
  }

  // The metadata entry exists only where a real scan row supplied it. There
  // is no branch that writes a scan id from anything else.
  const metadata: Record<string, string> =
    resolved.scanId === null ? { originKind: a.origin.kind } : { originKind: a.origin.kind, scanId: resolved.scanId };

  try {
    const session = await stripe().checkout.sessions.create({
      ...toVendorParams(checkoutParams()),
      ...returnUrls(returnTo.url),
      metadata,
    });
    if (session.url === null || session.url === undefined) {
      // A session with no URL is a session nobody can pay through. It is
      // the vendor arm, not a half-success handed to a surface.
      checkoutEvent({ sessionId: session.id, originKind: a.origin.kind, outcome: "vendor" });
      return { ok: false, reason: "vendor" };
    }
    checkoutEvent({ sessionId: session.id, originKind: a.origin.kind, outcome: "created" });
    return { ok: true, url: session.url, sessionId: session.id };
  } catch {
    // The vendor's own error text never reaches a caller: a surface renders
    // a written line from the arm, and a vendor payload is not a sentence
    // this product speaks.
    checkoutEvent({ sessionId: "", originKind: a.origin.kind, outcome: "vendor" });
    return { ok: false, reason: "vendor" };
  }
}
