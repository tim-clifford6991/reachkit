import { beforeEach, expect, test, vi } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mock factory for serverDb().
//
// Models the two query shapes handleStripeEvent uses against "users":
//   - lookup:  .from("users").select("id").eq("stripe_customer_id", c).maybeSingle()
//   - update:  .from("users").update(payload).eq("id", id)
//
// Returns the spies so tests can assert the captured update payload + the
// column/value the update was keyed on.
// ---------------------------------------------------------------------------
function makeServerDb(lookupRow: { id: string } | null, opts: { alreadySeen?: boolean } = {}) {
  const captured: { update: Record<string, unknown> | null; eqArgs: [string, unknown] | null } = {
    update: null,
    eqArgs: null,
  };

  // --- users chain: select(...).eq(...).maybeSingle() + update(...).eq(...) ---
  const maybeSingle = vi.fn().mockResolvedValue({ data: lookupRow, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const updateEq = vi.fn((col: string, val: unknown) => {
    captured.eqArgs = [col, val];
    return Promise.resolve({ error: null });
  });
  const update = vi.fn((payload: Record<string, unknown>) => {
    captured.update = payload;
    return { eq: updateEq };
  });

  // --- ledger chain (processed_stripe_events): select(...).eq(...).maybeSingle()
  //     for alreadyProcessed, insert(...) for recordProcessed. `alreadySeen`
  //     models a redelivery whose event id is already recorded. ---
  const ledgerMaybeSingle = vi.fn().mockResolvedValue({ data: opts.alreadySeen ? { event_id: "seen" } : null, error: null });
  const ledgerSelectEq = vi.fn().mockReturnValue({ maybeSingle: ledgerMaybeSingle });
  const ledgerSelect = vi.fn().mockReturnValue({ eq: ledgerSelectEq });
  const insert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) =>
    table === "processed_stripe_events" ? { select: ledgerSelect, insert } : { select, update },
  );
  const serverDb = vi.fn().mockReturnValue({ from });

  return { serverDb, captured, spies: { from, select, selectEq, maybeSingle, update, updateEq, insert, ledgerSelectEq } };
}

const PRICE_MAP = { solo: "price_solo_123", growth: "price_growth_456" };

beforeEach(() => {
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// customer.subscription.updated → tier/status/period reconciled by customer.
// ---------------------------------------------------------------------------
test("handleStripeEvent: subscription.updated sets tier/status/period for the resolved user", async () => {
  const db = makeServerDb({ id: "user-1" });

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  // period end: 2030-01-01T00:00:00Z in unix seconds.
  const periodEndUnix = Math.floor(Date.UTC(2030, 0, 1) / 1000);

  const event = {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_abc",
        customer: "cus_xyz",
        status: "active",
        items: {
          data: [
            {
              current_period_end: periodEndUnix,
              price: { id: PRICE_MAP.growth },
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(event);

  // Looked the user up by stripe_customer_id.
  expect(db.spies.selectEq).toHaveBeenCalledWith("stripe_customer_id", "cus_xyz");

  // Update keyed on the resolved user id.
  expect(db.captured.eqArgs).toEqual(["id", "user-1"]);

  // Update payload reconciled from Stripe state.
  expect(db.captured.update).toEqual({
    subscription_status: "active",
    current_period_end: new Date(periodEndUnix * 1000).toISOString(),
    tier: "growth",
    stripe_subscription_id: "sub_abc",
  });
});

// ---------------------------------------------------------------------------
// customer.subscription.deleted → tier=free, status=canceled.
// ---------------------------------------------------------------------------
test("handleStripeEvent: subscription.deleted downgrades the user to free/canceled", async () => {
  const db = makeServerDb({ id: "user-2" });

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    type: "customer.subscription.deleted",
    data: {
      object: {
        id: "sub_gone",
        customer: "cus_del",
        status: "canceled",
        items: { data: [] },
      },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(event);

  expect(db.spies.selectEq).toHaveBeenCalledWith("stripe_customer_id", "cus_del");
  expect(db.captured.eqArgs).toEqual(["id", "user-2"]);
  expect(db.captured.update).toEqual({ tier: "free", subscription_status: "canceled" });
});

// ---------------------------------------------------------------------------
// checkout.session.completed → persists customer + subscription ids by userId.
// ---------------------------------------------------------------------------
test("handleStripeEvent: checkout.session.completed persists customer + subscription ids", async () => {
  const db = makeServerDb(null); // no customer lookup needed for this path

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        metadata: { userId: "user-3" },
        client_reference_id: null,
        customer: "cus_new",
        subscription: "sub_new",
      },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(event);

  // Keyed by user id (from metadata), not by customer lookup.
  expect(db.captured.eqArgs).toEqual(["id", "user-3"]);
  expect(db.captured.update).toEqual({
    stripe_customer_id: "cus_new",
    stripe_subscription_id: "sub_new",
  });
});

// ---------------------------------------------------------------------------
// No user resolved for a customer → no-op, no throw, no update.
// ---------------------------------------------------------------------------
test("handleStripeEvent: subscription event with no matching user is a no-op (no throw)", async () => {
  const db = makeServerDb(null); // lookup returns no row

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_orphan",
        customer: "cus_unknown",
        status: "active",
        items: { data: [{ current_period_end: 1893456000, price: { id: PRICE_MAP.solo } }] },
      },
    },
  } as unknown as Stripe.Event;

  await expect(handleStripeEvent(event)).resolves.toBeUndefined();
  expect(db.spies.update).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Idempotency ledger: a redelivered checkout.session.completed runs provisioning
// only once (first-see wins; unique-violation on redelivery → skipped).
// ---------------------------------------------------------------------------
test("handleStripeEvent: a redelivered (already-recorded) checkout.session.completed skips provisioning", async () => {
  const db = makeServerDb(null, { alreadySeen: true });

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    id: "evt_dupe",
    type: "checkout.session.completed",
    data: {
      object: { id: "cs_dupe", metadata: { userId: "user-3" }, client_reference_id: null, customer: "cus_dupe", subscription: "sub_dupe" },
    },
  } as unknown as Stripe.Event;

  await handleStripeEvent(event);

  // Already recorded → provisioning (the users update) never ran, and we did NOT
  // re-record.
  expect(db.spies.ledgerSelectEq).toHaveBeenCalledWith("event_id", "evt_dupe");
  expect(db.spies.update).not.toHaveBeenCalled();
  expect(db.spies.insert).not.toHaveBeenCalled();
});

test("handleStripeEvent: mark-AFTER-success — a first delivery that fails provisioning is NOT recorded (Stripe retry self-heals)", async () => {
  const db = makeServerDb({ id: "user-3" }); // not yet seen
  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));
  // Provisioning throws (transient failure on a brand-new customer).
  vi.doMock("@/lib/billing/provision", () => ({
    provisionCheckoutUser: vi.fn().mockRejectedValue(new Error("auth admin transient failure")),
    ensureAuthUser: vi.fn(),
  }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    id: "evt_fail",
    type: "checkout.session.completed",
    // payment-first shape (no metadata.userId) → goes through provisionCheckoutUser
    data: { object: { id: "cs_fail", metadata: {}, client_reference_id: null, customer: "cus_fail", subscription: "sub_fail", customer_details: { email: "new@buyer.com" } } },
  } as unknown as Stripe.Event;

  // The throw propagates (route returns 500 → Stripe retries)...
  await expect(handleStripeEvent(event)).rejects.toThrow(/transient/);
  // ...and CRUCIALLY the event was NOT recorded as processed.
  expect(db.spies.insert).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Unhandled event type → no-op (no db access).
// ---------------------------------------------------------------------------
test("handleStripeEvent: unhandled event type is a no-op", async () => {
  const db = makeServerDb(null);

  vi.doMock("@/lib/billing/stripe", () => ({ priceMap: () => PRICE_MAP }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: db.serverDb }));

  const { handleStripeEvent } = await import("./webhook");

  const event = {
    type: "invoice.paid",
    data: { object: {} },
  } as unknown as Stripe.Event;

  await expect(handleStripeEvent(event)).resolves.toBeUndefined();
  expect(db.spies.from).not.toHaveBeenCalled();
});
