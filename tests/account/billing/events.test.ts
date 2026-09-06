// tests/account/billing/events.test.ts — REQ-076 c8; REQ-097 c4
//
// The five subscription events, the one column they move, and the arm that
// must stay empty: **nothing is invented for a failed renewal**. REQ-076's
// non-goal defers refunds, chargebacks and `past_due` by owner ruling, and
// REQ-097 c4 says the same from the customer's side — ReachKit sends no
// mail on a billing event at all. The `past_due` case below fails if any
// behaviour is added to that branch.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { onSubscriptionEvent, openSubscription, hasActiveAccess, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { STRIPE_EVENTS } = await import("@/lib/account/provisioning/events");
const { setStripe } = await import("@/lib/account/stripe/client");
const { memoryBillingStore, newMemoryBilling, account, site, storedUser } = await import("./memory-store");
const { newStripeDouble, stripeDouble, subscriptionDouble } = await import("../stripe-double");

let state = newMemoryBilling();
let vendor = newStripeDouble();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  vendor = newStripeDouble();
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
  sendCalls.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  setStripe(null);
  vi.restoreAllMocks();
});

/** A subscription event, in the shape the vendor delivers one. */
function subscriptionEvent(a: {
  id?: string;
  type?: string;
  periodEnd: Date;
  status?: string;
  cancelAtPeriodEnd?: boolean;
}): Parameters<typeof onSubscriptionEvent>[0] {
  return {
    id: a.id ?? "evt_1",
    type: a.type ?? "customer.subscription.updated",
    data: {
      object: subscriptionDouble({
        id: "sub_1",
        customer: "cus_u1",
        periodEnd: a.periodEnd,
        status: a.status,
        cancelAtPeriodEnd: a.cancelAtPeriodEnd,
      }),
    },
  } as unknown as Parameters<typeof onSubscriptionEvent>[0];
}

/** An invoice event, whose subscription is named by the invoice's parent. */
function invoiceEvent(a: { id?: string; type: string }): Parameters<typeof onSubscriptionEvent>[0] {
  return {
    id: a.id ?? "evt_inv",
    type: a.type,
    data: {
      object: {
        id: "in_1",
        parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
      },
    },
  } as unknown as Parameters<typeof onSubscriptionEvent>[0];
}

function paying(a: { paidThrough: Date; planStatus?: string }): void {
  state.users.push(
    account({
      id: "u1",
      paid_through: a.paidThrough.toISOString(),
      plan_status: a.planStatus ?? "active",
      stripe_customer_id: "cus_u1",
      stripe_subscription_id: "sub_1",
    })
  );
  state.sites.push(
    site({ id: "s1", user_id: "u1", owner_paid_through: a.paidThrough.toISOString() })
  );
}

describe("the five routed types are the five this module handles", () => {
  it("every `subscription` row in the closed event list reaches this handler", () => {
    const routed = Object.entries(STRIPE_EVENTS)
      .filter(([, route]) => route === "subscription")
      .map(([type]) => type)
      .sort();
    expect(routed).toEqual([
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
      "invoice.paid",
      "invoice.payment_failed",
    ]);
  });
});

describe("REQ-076 c8 — a renewal advances the gate", () => {
  it("paid_through moves to the subscription's period end", async () => {
    const was = new Date(NOW.getTime() + DAY);
    const now = new Date(NOW.getTime() + 31 * DAY);
    paying({ paidThrough: was });

    expect(await onSubscriptionEvent(subscriptionEvent({ periodEnd: now }))).toEqual({
      applied: true,
    });
    expect(storedUser(state).paid_through).toBe(now.toISOString());
    expect(await hasActiveAccess("s1")).toBe(true);
  });

  it("an invoice event advances it too, through the subscription its parent names", async () => {
    const later = new Date(NOW.getTime() + 31 * DAY);
    paying({ paidThrough: new Date(NOW.getTime() + DAY) });
    vendor.subscriptions.set(
      "sub_1",
      subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd: later })
    );

    expect(await onSubscriptionEvent(invoiceEvent({ type: "invoice.paid" }))).toEqual({
      applied: true,
    });
    expect(storedUser(state).paid_through).toBe(later.toISOString());
  });

  it("the first event finds the account by customer, before any row names the subscription", async () => {
    state.users.push(
      account({
        id: "u1",
        stripe_customer_id: "cus_u1",
        stripe_subscription_id: null,
        paid_through: NOW.toISOString(),
      })
    );
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    expect(
      await onSubscriptionEvent(
        subscriptionEvent({ type: "customer.subscription.created", periodEnd })
      )
    ).toEqual({ applied: true });
    expect(storedUser(state).stripe_subscription_id).toBe("sub_1");
    expect(storedUser(state).paid_through).toBe(periodEnd.toISOString());
  });
});

describe("REQ-076 non-goal — nothing is invented for a failed renewal", () => {
  it("payment_failed records the status, moves paid_through by nothing, and sends no mail", async () => {
    // The mutation case: adding a mail, a retry, a downgrade or a
    // revocation to this branch fails here.
    const paidThrough = new Date(NOW.getTime() + 10 * DAY);
    paying({ paidThrough });
    vendor.subscriptions.set(
      "sub_1",
      subscriptionDouble({
        id: "sub_1",
        customer: "cus_u1",
        periodEnd: paidThrough,
        status: "past_due",
      })
    );

    await onSubscriptionEvent(invoiceEvent({ type: "invoice.payment_failed" }));

    expect(storedUser(state).paid_through).toBe(paidThrough.toISOString());
    expect(storedUser(state).plan_status).toBe("past_due");
    expect(sendCalls).toHaveLength(0);
    expect(vendor.subscriptionUpdates).toEqual([]);
    expect(vendor.cancelled).toEqual([]);
    expect(vendor.chargesCreated).toBe(0);
  });

  it("REQ-076 c8 — a past_due account still has access until the date passes", async () => {
    const paidThrough = new Date(NOW.getTime() + 10 * DAY);
    paying({ paidThrough });
    vendor.subscriptions.set(
      "sub_1",
      subscriptionDouble({
        id: "sub_1",
        customer: "cus_u1",
        periodEnd: paidThrough,
        status: "past_due",
      })
    );
    await onSubscriptionEvent(invoiceEvent({ type: "invoice.payment_failed" }));
    expect(await hasActiveAccess("s1")).toBe(true);
  });

  it("REQ-097 c4 — no ReachKit mail follows any of the five", async () => {
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    paying({ paidThrough: NOW });
    for (const type of [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ]) {
      await onSubscriptionEvent(
        subscriptionEvent({ id: `evt_${type}`, type, periodEnd })
      );
    }
    for (const type of ["invoice.paid", "invoice.payment_failed"]) {
      vendor.subscriptions.set(
        "sub_1",
        subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd })
      );
      await onSubscriptionEvent(invoiceEvent({ id: `evt_${type}`, type }));
    }
    expect(sendCalls).toHaveLength(0);
  });
});

describe("idempotence, and the direction the gate may move", () => {
  it("a second delivery of the same event id changes nothing and says `replay`", async () => {
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    paying({ paidThrough: NOW });

    const event = subscriptionEvent({ id: "evt_once", periodEnd });
    expect(await onSubscriptionEvent(event)).toEqual({ applied: true });
    expect(storedUser(state).last_subscription_event_id).toBe("evt_once");

    expect(await onSubscriptionEvent(event)).toEqual({ applied: false, because: "replay" });
    expect(storedUser(state).paid_through).toBe(periodEnd.toISOString());
  });

  it("an out-of-order redelivery never moves paid_through backwards", async () => {
    // Vendor events are not ordered. An event that moved the gate back
    // would take access from somebody who has it.
    const later = new Date(NOW.getTime() + 31 * DAY);
    paying({ paidThrough: NOW });
    await onSubscriptionEvent(subscriptionEvent({ id: "evt_new", periodEnd: later }));
    expect(storedUser(state).paid_through).toBe(later.toISOString());

    const earlier = new Date(NOW.getTime() + DAY);
    await onSubscriptionEvent(subscriptionEvent({ id: "evt_old", periodEnd: earlier }));
    expect(storedUser(state).paid_through).toBe(later.toISOString());
  });

  it("the cancellation the vendor reports is mirrored, and is not the gate", async () => {
    const periodEnd = new Date(NOW.getTime() + 20 * DAY);
    paying({ paidThrough: periodEnd });

    await onSubscriptionEvent(
      subscriptionEvent({ id: "evt_cancel", periodEnd, cancelAtPeriodEnd: true })
    );
    expect(storedUser(state).cancelled_at).not.toBeNull();
    // ADR-050: a cancelled account keeps access until the date passes.
    expect(await hasActiveAccess("s1")).toBe(true);

    await onSubscriptionEvent(
      subscriptionEvent({ id: "evt_resume", periodEnd, cancelAtPeriodEnd: false })
    );
    expect(storedUser(state).cancelled_at).toBeNull();
  });
});

describe("events with nothing to apply", () => {
  it("an event for a customer this database does not know is `no_account`, not an error", async () => {
    // `checkout.session.completed` may simply not have been processed yet;
    // provisioning stamps the first period end itself when it is.
    expect(
      await onSubscriptionEvent(subscriptionEvent({ periodEnd: new Date(NOW.getTime() + DAY) }))
    ).toEqual({ applied: false, because: "no_account" });
  });

  it("an invoice with no subscription parent is `vendor`, and writes nothing", async () => {
    paying({ paidThrough: NOW });
    const orphan = {
      id: "evt_x",
      type: "invoice.paid",
      data: { object: { id: "in_1", parent: null } },
    } as unknown as Parameters<typeof onSubscriptionEvent>[0];
    expect(await onSubscriptionEvent(orphan)).toEqual({ applied: false, because: "vendor" });
    expect(storedUser(state).paid_through).toBe(NOW.toISOString());
  });

  it("a subscription with no period is `no_period` — a month is never invented", async () => {
    paying({ paidThrough: NOW });
    const noPeriod = {
      id: "evt_np",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_u1", status: "active", items: { data: [] } } },
    } as unknown as Parameters<typeof onSubscriptionEvent>[0];
    expect(await onSubscriptionEvent(noPeriod)).toEqual({ applied: false, because: "no_period" });
  });
});

describe("openSubscription — provisioning's own stamp", () => {
  it("stamps the first period end, so a paid account has access at once", async () => {
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    state.users.push(
      account({ id: "u1", paid_through: NOW.toISOString(), stripe_subscription_id: null })
    );
    state.sites.push(site({ id: "s1", user_id: "u1", owner_paid_through: NOW.toISOString() }));
    vendor.subscriptions.set(
      "sub_1",
      subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd })
    );

    expect(await openSubscription({ userId: "u1", subscriptionId: "sub_1" })).toEqual({ ok: true });
    expect(storedUser(state).paid_through).toBe(periodEnd.toISOString());
    expect(storedUser(state).stripe_subscription_id).toBe("sub_1");
  });

  it("carries no event id — it is not an event", async () => {
    const periodEnd = new Date(NOW.getTime() + 30 * DAY);
    state.users.push(
      account({ id: "u1", last_subscription_event_id: null, stripe_subscription_id: null })
    );
    vendor.subscriptions.set(
      "sub_1",
      subscriptionDouble({ id: "sub_1", customer: "cus_u1", periodEnd })
    );
    await openSubscription({ userId: "u1", subscriptionId: "sub_1" });
    expect(storedUser(state).last_subscription_event_id).toBeNull();
  });

  it("a vendor that cannot be read leaves the account open on the column's default", async () => {
    state.users.push(account({ id: "u1", paid_through: NOW.toISOString() }));
    vendor.subscriptionRetrieveError = new Error("stripe is down");
    expect(await openSubscription({ userId: "u1", subscriptionId: "sub_1" })).toEqual({
      ok: false,
    });
    expect(storedUser(state).paid_through).toBe(NOW.toISOString());
  });
});
