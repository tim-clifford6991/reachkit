// src/lib/account/provisioning/webhook.ts — BUILD §13
//
// **The signature is the whole of the trust boundary.** §13: the webhook is
// "signature-verified, the only provisioning path". A request that arrives
// here is a stranger's bytes claiming a payment completed; the one thing
// that makes it ours is the signature, and this file is where that is
// decided. `POST /api/stripe/webhook` verifies nothing — it hands the raw
// bytes over — so there is exactly one place the check lives and exactly
// one place to look for it.
//
// **Verification strictly precedes parsing.** The vendor SDK's own
// constructor is given the raw body; nothing here calls `JSON.parse` first,
// nothing normalises line endings, and nothing re-encodes. A signature is
// over bytes: a round-trip through a string would make every live webhook
// fail while every test that stubs the verifier passed.
//
// **An unknown event is an answer, never a throw.** A verified event whose
// type is not in `STRIPE_EVENTS` is reported as `unknown_event` — Stripe
// retries a 5xx, so throwing on an event we simply do not handle would
// enqueue an indefinite retry of nothing.
//
// This module creates no table and writes no row of its own. The durable
// record that lets a replayed delivery be recognised is the `users` row's
// `checkout_session_id`, which the provisioning branch writes.
import { env } from "@/lib/config/env";
import { stripe, type Stripe } from "../stripe/client";
import { STRIPE_EVENTS, type StripeEventRoute } from "./events";

export type WebhookResult =
  | { handled: true; event: string; route: StripeEventRoute }
  | { handled: false; reason: "signature" | "unknown_event" };

/** What the `subscription` route calls. Issue #34 owns the rule; until it
 *  registers, a subscription event is verified, recognised and recorded as
 *  routed, and nothing happens to it — which is what is true. */
export type SubscriptionHandler = (event: Stripe.Event) => Promise<void>;

let subscriptionHandler: SubscriptionHandler | null = null;

/** Wired by `src/lib/account/billing/**` (issue #34); `null` unwires. */
export function registerSubscriptionHandler(handler: SubscriptionHandler | null): void {
  subscriptionHandler = handler;
}

/** What the `provision` route calls, behind a narrow function type so this
 *  file holds no provisioning logic and the two can be tested apart. */
export type ProvisionHandler = (sessionId: string) => Promise<unknown>;

let provisionHandler: ProvisionHandler | null = null;

/** Swaps the provisioning call. The suites' one door in; `null` restores
 *  `provisionFromPayment`. */
export function registerProvisionHandler(handler: ProvisionHandler | null): void {
  provisionHandler = handler;
}

function log(fields: { outcome: string; type: string | null }): void {
  // No raw body, no signature header, no secret, no session URL, no
  // address. The event type and the outcome, which is what a person
  // debugging a webhook needs and the whole of what they may have.
  console.log(JSON.stringify({ event: "stripe_webhook", ...fields }));
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<WebhookResult> {
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    // Nothing has been parsed, nothing has been read and no other module
    // has been called. A tampered body, a wrong secret, a stale timestamp
    // and an absent signature are the same answer, on purpose: telling
    // them apart tells a prober which one they got right.
    log({ outcome: "signature", type: null });
    return { handled: false, reason: "signature" };
  }

  const route = STRIPE_EVENTS[event.type];
  if (route === undefined) {
    log({ outcome: "unknown_event", type: event.type });
    return { handled: false, reason: "unknown_event" };
  }

  if (route === "provision") {
    const session = event.data.object as Stripe.Checkout.Session;
    const handler = provisionHandler ?? (await defaultProvisionHandler());
    await handler(session.id);
  } else if (route === "subscription") {
    await subscriptionHandler?.(event);
  }

  log({ outcome: route, type: event.type });
  return { handled: true, event: event.type, route };
}

/** `provisionFromPayment`, imported lazily so this module and
 *  `provision.ts` do not form a load-time cycle through the store. */
async function defaultProvisionHandler(): Promise<ProvisionHandler> {
  const { provisionFromPayment } = await import("./provision");
  return (sessionId) => provisionFromPayment(sessionId);
}
