// src/lib/account/provisioning/duplicates.ts — BUILD §13
//
// The two ways a completed payment can arrive at an address that already
// has an account, and what each one does. They are different situations and
// they get different answers.
//
// **Replay** — the same session delivered twice. An at-least-once webhook
// does this routinely. Nothing was bought twice, so: no mail, no sign-in
// link, no deep pass, no write. The `users_checkout_session_id_key`
// constraint is what noticed, and the right response to it is to do
// nothing at all.
//
// **Second purchase** — a *different* session from an address that already
// has an account. Money left somebody's bank for a subscription they
// already have. REQ-024 criterion 3 fixes the order:
//
//   1. Cancel the subscription the second payment just created. Not
//      optional. Leaving it running means the customer is billed twice
//      every month from here on, and the first month's charge is the least
//      of it.
//   2. Send exactly one `account` mail saying it bought no second
//      subscription, naming one way to reach a person — the person who
//      refunds it.
//   3. Send no sign-in link and queue no deep pass. They have both already.
//
// Cancelling is deliberately attempted before the mail: a mail that says
// "this bought you nothing" while a second subscription quietly renews is
// the one outcome worse than saying nothing.
import { sendEmail } from "@/lib/mail/send";
import { buildSecondPurchase } from "@/lib/mail/templates/account";
import { stripe, type Stripe } from "../stripe/client";

export type DuplicateKind = "replay" | "second_purchase";

export interface SecondPurchaseOutcome {
  readonly cancelled: boolean;
  readonly told: boolean;
}

/** The subscription id a completed session created, where the session
 *  carries one expanded or by reference. */
function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  const subscription = session.subscription;
  if (subscription === null || subscription === undefined) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

/** Cancels the subscription the second payment created. Immediately, not at
 *  period end: a subscription that runs to period end is a second month of
 *  access nobody asked for and a second invoice to refund. */
async function cancelSecondSubscription(sessionId: string): Promise<boolean> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const subscriptionId = subscriptionIdOf(session);
    if (subscriptionId === null) return false;
    await stripe().subscriptions.cancel(subscriptionId);
    return true;
  } catch {
    return false;
  }
}

export async function handleSecondPurchase(a: {
  sessionId: string;
  email: string;
}): Promise<SecondPurchaseOutcome> {
  const cancelled = await cancelSecondSubscription(a.sessionId);

  const mail = buildSecondPurchase();
  const sent = await sendEmail({ kind: "account", to: a.email, subject: mail.subject, blocks: mail.blocks });

  console.log(
    JSON.stringify({
      event: "second_purchase",
      cancelled,
      told: sent.sent,
      // Named because it is the alert: a second purchase that could not be
      // cancelled is money this product is taking and should not be.
      needsPerson: !cancelled,
    })
  );
  return { cancelled, told: sent.sent };
}
