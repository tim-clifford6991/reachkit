import type Stripe from "stripe";
import { serverDb } from "@/lib/db/client";
import { priceMap } from "@/lib/billing/stripe";
import { tierForPriceId } from "@/lib/billing/tiers";
import type { Database } from "@/lib/db/types";

type UsersUpdate = Database["public"]["Tables"]["users"]["Update"];

/**
 * Reconcile a verified Stripe event into the `users` row.
 *
 * Idempotent: every handler is pure last-write-wins from the current Stripe
 * object state, so redelivered/out-of-order events converge to the same row.
 *
 * Handled event types:
 *   - checkout.session.completed       → persist customer + subscription ids
 *   - customer.subscription.created    → set status/period/tier/sub id
 *   - customer.subscription.updated    → set status/period/tier/sub id
 *   - customer.subscription.deleted    → tier=free, status=canceled
 * Any other event type is a no-op.
 *
 * If no user row resolves for a customer, we log and return (never throw) so
 * the webhook still 200s and Stripe stops retrying a non-actionable event.
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
// checkout.session.completed → bind Stripe customer + subscription to the user.
// Tier/status are intentionally NOT set here; the subscription.* event that
// follows is the source of truth for those.
// ---------------------------------------------------------------------------
async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    console.warn("[stripe webhook] checkout.session.completed without userId — ignoring", {
      sessionId: session.id,
    });
    return;
  }

  const update: UsersUpdate = {
    stripe_customer_id: customerId(session.customer),
    stripe_subscription_id: subscriptionId(session.subscription),
  };

  await updateUserById(userId, update, "checkout.session.completed");
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

  await updateUserByCustomer(customer, update, source);
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

  if (!user) {
    console.warn(
      `[stripe webhook] ${source}: no user for customer ${customer} — ignoring`,
    );
    return;
  }

  const { error: updateError } = await db.from("users").update(update).eq("id", user.id);
  if (updateError) {
    console.error(
      `[stripe webhook] ${source}: failed to update user ${user.id}`,
      updateError.message,
    );
  }
}
