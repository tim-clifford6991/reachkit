// src/lib/account/checkout/session.ts — §13 Payments, REQ-021 c4/c5 (issue #19)
//
// **The declared checkout seam, and nothing behind it yet.** §13:
// "Stripe Checkout from the report (scan id in metadata) or any price
// surface (scanless — no fabricated scan id)." Issue #33 builds the Stripe
// half — the Price object, the session, the checkout facts and the webhook.
// This file exists so the price surface (issue #19) can be written against
// the interface that half will satisfy, in one place, rather than against a
// shape invented at its call site.
//
// **No section marker, deliberately.** `scripts/drift-audit.mjs` reads a
// `§13` citation carrying the spec-file keyword as "this section is
// built", and §13 is not: nothing here reaches Stripe. Withholding the
// keyword keeps §13 reported as the GAP it is until #33 lands, which is
// the whole point of the audit; #33 adds the marker with the
// implementation. That is why §13 is cited bare, above and below.
//
// **The stub throws; it never answers.** A stub that returned a plausible
// `{ ok: true, url }` would put a dead link in front of a buyer and read,
// in every test and every preview, exactly like a working checkout. This
// one names the issue that owes the implementation.

/** Where the buyer came from. `scanId` is present only when a completed
 *  report exists for it; the `pricing` arm carries no `scanId` field at all,
 *  so a scanless surface cannot fabricate one — §13's "scanless — no
 *  fabricated scan id" is a property of this type, not of a call site's
 *  discipline. */
export type CheckoutOrigin = { kind: "report"; scanId: string } | { kind: "pricing" };

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string }
  | { ok: false; reason: "origin_scan_incomplete" | "return_to_not_ours" | "vendor" };

export class CheckoutNotImplementedError extends Error {
  constructor() {
    super(
      "createCheckoutSession is declared, not implemented: the Stripe half is issue #33. " +
        "No checkout session was created and no payment was taken."
    );
    this.name = "CheckoutNotImplementedError";
  }
}

/**
 * Begins Stripe Checkout for `origin`, returning the URL to send the buyer
 * to. `returnTo` is an absolute ReachKit URL, allow-listed against
 * `NEXT_PUBLIC_APP_URL` by the implementation.
 *
 * Throws `CheckoutNotImplementedError` until issue #33 supplies the body.
 */
export async function createCheckoutSession(a: {
  origin: CheckoutOrigin;
  returnTo: string;
}): Promise<CheckoutResult> {
  // Named and discarded: the argument is the interface issue #33 will
  // implement against, and nothing here may read it — a stub that logged a
  // buyer's return URL would be doing work this file promises it does not.
  void a;
  throw new CheckoutNotImplementedError();
}
