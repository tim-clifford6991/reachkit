import type Stripe from "stripe";
import { serverDb } from "@/lib/db/client";
import { priceMap, stripeClient } from "@/lib/billing/stripe";
import { tierForPriceId } from "@/lib/billing/tiers";
import { ensureAuthUser, provisionCheckoutUser } from "@/lib/billing/provision";
import type { Database } from "@/lib/db/types";

type UsersUpdate = Database["public"]["Tables"]["users"]["Update"];

/**
 * Reconcile a verified Stripe event into the `users` row.
 *
 * Idempotent: every handler is pure last-write-wins from the current Stripe
 * object state, so redelivered/out-of-order events converge to the same row.
 *
 * Handled event types:
 *   - checkout.session.completed       → legacy: persist ids; payment-first:
 *                                        create account from email, link scan,
 *                                        send onboarding magic link
 *   - customer.subscription.created    → set status/period/tier/sub id
 *   - customer.subscription.updated    → set status/period/tier/sub id
 *   - customer.subscription.deleted    → tier=free, status=canceled
 * Any other event type is a no-op.
 *
 * If no user row resolves for a customer (and the event isn't eligible for a
 * defensive create), we log and return (never throw) so the webhook still 200s
 * and Stripe stops retrying a non-actionable event.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await onSubscriptionUpsert(event.data.object, event.type);
      return;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object);
      return;
    default:
      // Unhandled event type — no-op.
      return;
  }
}

// ---------------------------------------------------------------------------
// checkout.session.completed
//
// Two shapes:
//   - Legacy in-app upgrade (metadata.userId present): the user already exists;
//     just bind the Stripe ids. Tier/status come from the subscription.* event.
//   - Payment-first funnel (anonymous; metadata.scanId or none): no user yet —
//     create-or-find the account from the Stripe-collected email, bind ids, link
//     the scanned app (if any), and send the onboarding magic link. Account
//     creation MUST happen here so the following subscription.* event (which
//     resolves the user by stripe_customer_id) can set tier/status.
// ---------------------------------------------------------------------------
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const legacyUserId = session.metadata?.userId ?? null;
  const customer = customerId(session.customer);
  const subscription = subscriptionId(session.subscription);

  // Legacy authenticated upgrade path — unchanged behaviour.
  if (legacyUserId) {
    await updateUserById(
      legacyUserId,
      { stripe_customer_id: customer, stripe_subscription_id: subscription },
      "checkout.session.completed",
    );
    return;
  }

  // Payment-first funnel.
  const scanId = session.metadata?.scanId ?? session.client_reference_id ?? null;
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  if (!email) {
    console.warn("[stripe webhook] checkout.session.completed without an email — ignoring", {
      sessionId: session.id,
    });
    return;
  }

  await provisionCheckoutUser({
    email,
    scanId,
    stripeCustomerId: customer,
    stripeSubscriptionId: subscription,
    // Tier/status are set by the subscription.* event, not here.
    sendMagicLink: true,
  });
}

// ---------------------------------------------------------------------------
// customer.subscription.created / .updated → reconcile status, period, tier.
// In the 2026-05-27.dahlia API version, `current_period_end` and the price id
// live on the subscription ITEM (sub.items.data[0]), not the subscription root.
// ---------------------------------------------------------------------------
async function onSubscriptionUpsert(
  sub: Stripe.Subscription,
  source: string,
): Promise<void> {
  const customer = customerId(sub.customer);
  if (!customer) {
    console.warn("[stripe webhook] subscription event without a resolvable customer — ignoring", {
      subscriptionId: sub.id,
    });
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? "";

  const update: UsersUpdate = {
    subscription_status: sub.status,
    current_period_end: periodEndIso(item?.current_period_end),
    tier: tierForPriceId(priceId, priceMap()),
    stripe_subscription_id: sub.id,
  };

  // Defensive create: if the subscription.* event wins the race against
  // checkout.session.completed, no user row exists for this customer yet. Rather
  // than silently drop the tier, create-or-find the account from the Stripe
  // customer email and bind the customer id before applying the update.
  await updateUserByCustomer(customer, update, source, { createIfMissing: true });
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted → downgrade to free, mark canceled.
// ---------------------------------------------------------------------------
async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customer = customerId(sub.customer);
  if (!customer) {
    console.warn("[stripe webhook] subscription.deleted without a resolvable customer — ignoring", {
      subscriptionId: sub.id,
    });
    return;
  }

  const update: UsersUpdate = {
    tier: "free",
    subscription_status: "canceled",
  };

  await updateUserByCustomer(customer, update, "customer.subscription.deleted");
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

/** Normalize an expandable Stripe customer field → its id (or null). */
function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (customer === null) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/** Normalize an expandable Stripe subscription field → its id (or null). */
function subscriptionId(
  subscription: string | Stripe.Subscription | null,
): string | null {
  if (subscription === null) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

/** Convert a unix-seconds period end → ISO string (null when absent). */
function periodEndIso(unixSeconds: number | undefined): string | null {
  if (typeof unixSeconds !== "number") return null;
  return new Date(unixSeconds * 1000).toISOString();
}

async function updateUserById(
  userId: string,
  update: UsersUpdate,
  source: string,
): Promise<void> {
  const { error } = await serverDb().from("users").update(update).eq("id", userId);
  if (error) {
    console.error(`[stripe webhook] ${source}: failed to update user ${userId}`, error.message);
  }
}

/** Resolve the user by stripe_customer_id, then apply the update by id. */
async function updateUserByCustomer(
  customer: string,
  update: UsersUpdate,
  source: string,
  opts: { createIfMissing?: boolean } = {},
): Promise<void> {
  const db = serverDb();

  const { data: user, error: lookupError } = await db
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customer)
    .maybeSingle();

  if (lookupError) {
    console.error(
      `[stripe webhook] ${source}: lookup failed for customer ${customer}`,
      lookupError.message,
    );
    return;
  }

  let userId = user?.id ?? null;

  // Defensive create: the subscription.* event raced ahead of checkout. Build
  // the account from the Stripe customer email and bind the customer id.
  if (!userId && opts.createIfMissing) {
    userId = await resolveOrCreateUserForCustomer(customer, source);
    if (userId) update.stripe_customer_id = customer;
  }

  if (!userId) {
    console.warn(
      `[stripe webhook] ${source}: no user for customer ${customer} — ignoring`,
    );
    return;
  }

  const { error: updateError } = await db.from("users").update(update).eq("id", userId);
  if (updateError) {
    console.error(
      `[stripe webhook] ${source}: failed to update user ${userId}`,
      updateError.message,
    );
  }
}

/**
 * Fetch the Stripe customer's email and create-or-find the matching account.
 * Returns the userId, or null when the email can't be resolved. No magic link
 * is sent here — the checkout.session.completed handler owns that.
 */
async function resolveOrCreateUserForCustomer(
  customer: string,
  source: string,
): Promise<string | null> {
  try {
    const stripeCustomer = await stripeClient().customers.retrieve(customer);
    if (stripeCustomer.deleted) return null;
    const email = stripeCustomer.email;
    if (!email) {
      console.warn(`[stripe webhook] ${source}: customer ${customer} has no email — cannot create`);
      return null;
    }
    return await ensureAuthUser(email);
  } catch (e) {
    console.error(`[stripe webhook] ${source}: defensive create failed for ${customer}`, e);
    return null;
  }
}
