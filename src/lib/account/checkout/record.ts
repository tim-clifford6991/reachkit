// src/lib/account/checkout/record.ts — BUILD §13
//
// The billing country and the VAT number a completed session collected,
// written onto the buyer's billing record — and nothing else written at all.
//
// §13, on the tax ruling: "collect the buyer's country (Stripe does
// automatically) and VAT ID field on, so the records exist when
// registration is set up." A record that was never captured cannot be
// reconstructed later, which is the whole reason these two are read off the
// session before provisioning rather than looked up when registration
// happens.
//
// **Both values are recorded exactly as they arrived.**
//   · The country is the two letters Stripe reported. Never re-cased, never
//     mapped to a name, never normalised to a list this repository keeps.
//   · The VAT number is verbatim as the buyer typed it — not trimmed, not
//     uppercased, not stripped of spaces, and not validated. REQ-022
//     criterion 7: the purchase completes "whatever any registry would say
//     about that number". A normalisation here is a validation wearing a
//     tidy-up's clothes: it decides what a valid number looks like.
//   · An empty VAT field lands as `null`, not `''` — "asked and left blank"
//     and "recorded as the empty string" are not the same fact.
//
// **Idempotent on the session id.** A second call re-reads and returns the
// same values; where the account already exists it writes them again onto
// the same row, which is the same row it wrote before.
import { accountStore, type BillingFacts } from "../store";
import { stripe, type Stripe } from "../stripe/client";
import type { CheckoutOrigin } from "./origin";
import { checkoutEvent } from "./redaction";

export interface CheckoutFacts {
  readonly email: string;
  /** ISO-3166-1 alpha-2 as Stripe reported it. */
  readonly billingCountry: string | null;
  /** Verbatim as entered; never normalised, never validated. */
  readonly vatNumber: string | null;
  readonly stripeCustomerId: string;
  /** The subscription this session opened, where it opened one. Read here
   *  because provisioning stamps `users.paid_through` from it (issue #34)
   *  and this is the one place the session is retrieved: the two webhook
   *  deliveries are not ordered, so an account that waited for
   *  `customer.subscription.created` to arrive could wait a month. */
  readonly subscriptionId: string | null;
  readonly origin: CheckoutOrigin;
}

export type RecordResult =
  | { ok: true; facts: CheckoutFacts }
  | { ok: false; reason: "session_not_complete" | "session_incomplete_facts" | "vendor" | "store" };

/** The `CheckoutOrigin` this session was opened with, read back out of the
 *  metadata `createCheckoutSession` wrote. A session whose metadata carries
 *  no scan id is a scanless purchase — the absence is the fact, and no
 *  other field of the session may supply one. In particular the payer's
 *  email domain and their billing address are never read as a domain
 *  (REQ-021 c7). */
function originFrom(metadata: Stripe.Metadata | null): CheckoutOrigin {
  const scanId = metadata?.scanId;
  return typeof scanId === "string" && scanId.length > 0
    ? { kind: "report", scanId }
    : { kind: "pricing" };
}

/** The customer id, whether the session carries it expanded or as a
 *  reference. `customer_creation: 'always'` means one exists. */
function customerIdOf(session: Stripe.Checkout.Session): string | null {
  const customer = session.customer;
  if (customer === null || customer === undefined) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/** The subscription the session opened, whether it carries it expanded or
 *  as a reference. A session in a mode that opens none reports `null`. */
function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  const subscription = session.subscription;
  if (subscription === null || subscription === undefined) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

/** The address the sign-in link and receipt go to. `customer_details.email`
 *  is what the buyer typed at checkout; `customer_email` is the pre-filled
 *  one where a surface supplied it. Neither is ever inferred from anything
 *  else. */
function emailOf(session: Stripe.Checkout.Session): string | null {
  return session.customer_details?.email ?? session.customer_email ?? null;
}

/** The first tax id the session collected, verbatim. `tax_id_collection`
 *  admits one; a session with none is a buyer who left the field empty. */
function vatNumberOf(session: Stripe.Checkout.Session): string | null {
  const first = session.customer_details?.tax_ids?.[0]?.value;
  // `''` is the empty field, and an empty field is "not given", not "given
  // as nothing" — the one normalisation this file makes, and it is about
  // absence rather than about the value's shape.
  return first === undefined || first === null || first === "" ? null : first;
}

export async function recordCheckoutFacts(sessionId: string): Promise<RecordResult> {
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    checkoutEvent({ sessionId, originKind: "pricing", outcome: "vendor" });
    return { ok: false, reason: "vendor" };
  }

  const origin = originFrom(session.metadata);

  // A session that did not complete has nothing to record and opens
  // nothing (REQ-024 c2). This is the second place that is true — the
  // first is the webhook, which only routes completed events — and both
  // are deliberate: neither trusts the other to have checked.
  if (session.status !== "complete") {
    checkoutEvent({ sessionId, originKind: origin.kind, outcome: "session_not_complete" });
    return { ok: false, reason: "session_not_complete" };
  }

  const email = emailOf(session);
  const stripeCustomerId = customerIdOf(session);
  if (email === null || stripeCustomerId === null) {
    checkoutEvent({ sessionId, originKind: origin.kind, outcome: "session_incomplete_facts" });
    return { ok: false, reason: "session_incomplete_facts" };
  }

  const facts: CheckoutFacts = {
    email,
    billingCountry: session.customer_details?.address?.country ?? null,
    vatNumber: vatNumberOf(session),
    stripeCustomerId,
    subscriptionId: subscriptionIdOf(session),
    origin,
  };

  // The write is best-effort onto an account that may not exist yet: on the
  // provisioning path this call runs *before* the `users` row is inserted,
  // and the insert carries the same three values. Where the row does
  // already exist — a replay, or the backstop re-running — this is the
  // write that keeps it current. Either way the caller gets the facts.
  const store = accountStore();
  const existing = await store.accountByCheckoutSession(sessionId);
  if (!existing.ok) {
    checkoutEvent({ sessionId, originKind: origin.kind, outcome: "store" });
    return { ok: false, reason: "store" };
  }
  if (existing.account !== null) {
    const billing: BillingFacts = {
      stripe_customer_id: stripeCustomerId,
      billing_country: facts.billingCountry,
      vat_number: facts.vatNumber,
    };
    const written = await store.writeBillingFacts(sessionId, billing);
    if (!written.ok) {
      checkoutEvent({ sessionId, originKind: origin.kind, outcome: "store" });
      return { ok: false, reason: "store" };
    }
  }

  checkoutEvent({ sessionId, originKind: origin.kind, outcome: "recorded" });
  return { ok: true, facts };
}
