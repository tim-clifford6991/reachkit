// src/lib/account/provisioning/events.ts — BUILD §13
//
// The closed list of vendor events this product acts on, and what each one
// is. A type absent from this map is not handled — that is what "closed"
// means, and it is why the map is a `Record` of literal keys rather than a
// switch with a default arm: an event Stripe adds tomorrow routes nowhere
// until somebody writes a row for it here.
//
// Three destinations, no more:
//   `provision`    — a payment completed; open the account (REQ-024).
//   `subscription` — the state of an existing subscription changed. Owned
//                    by billing (issue #34); named here so the webhook has
//                    somewhere to route it rather than dropping it.
//   `ignore`       — received, understood, deliberately acted on by
//                    nothing. Distinct from absent: absent means we do not
//                    know what it is.

export type StripeEventRoute = "provision" | "subscription" | "ignore";

export const STRIPE_EVENTS: Readonly<Record<string, StripeEventRoute>> = Object.freeze({
  // §13: the webhook is "the only provisioning path".
  "checkout.session.completed": "provision",

  // The subscription's own life. §13: "Portal for card/cancel; cancel keeps
  // access to period end" — every one of these moves `paid_through` or
  // `plan_status`, and issue #34 owns what each does.
  "customer.subscription.created": "subscription",
  "customer.subscription.updated": "subscription",
  "customer.subscription.deleted": "subscription",
  "invoice.paid": "subscription",
  "invoice.payment_failed": "subscription",

  // Received and deliberately acted on by nothing: the session expiring is
  // REQ-020 criterion 2's "leaves checkout without paying", and the answer
  // to it is that no account, site or subscription exists — which is
  // already true, and which no write could make truer.
  "checkout.session.expired": "ignore",
} as const);
