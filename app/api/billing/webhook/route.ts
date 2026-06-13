import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing/stripe";
import { env } from "@/lib/config/env";
import { handleStripeEvent } from "@/lib/billing/webhook";

/**
 * Stripe webhook endpoint.
 *
 * Live-test-only surface: in fixtures mode checkout sets state inline, so there
 * is no fixture path here. We read the RAW request body (required for signature
 * verification — any re-serialization would break the HMAC), verify the
 * `stripe-signature` header against STRIPE_WEBHOOK_SECRET, then reconcile.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(raw, sig, env.stripeWebhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    console.error("[stripe webhook] signature verification failed", message);
    return NextResponse.json({ error: `webhook signature verification failed` }, { status: 400 });
  }

  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
