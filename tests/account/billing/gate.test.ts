// tests/account/billing/gate.test.ts — REQ-076 c4, c8; ADR-050
//
// ADR-050's three cases, each written so that it **fails if the obvious
// clause is added**. The clause — "and the subscription is actually active"
// — reads like a tightening, is one line, and is invisible in every test
// written with a live subscription. These three are the tests that are not.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { hasActiveAccess, setBillingStore } = await import("@/lib/account/billing");
const { memoryBillingStore, newMemoryBilling, site } = await import("./memory-store");

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const IN_A_MONTH = new Date("2026-10-06T12:00:00.000Z");
const LAST_MONTH = new Date("2026-08-06T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
});

/** One site whose owner is in the given state. `planStatus` and
 *  `cancelled` are on the row precisely so the tests below can prove the
 *  gate never reads them. */
function given(a: { paidThrough: Date }): string {
  state.sites.push(site({ id: "site-1", user_id: "u-1", owner_paid_through: a.paidThrough.toISOString() }));
  return "site-1";
}

describe("REQ-076 c8 — the gate is the paid-through date and nothing else", () => {
  it("a cancelled subscription with a future paid_through HAS access", async () => {
    // REQ-076 c3: "measurement, generation and publishing continue
    // unchanged until that date". A gate that also asked whether the
    // subscription was cancelled would take the rest of a paid month away
    // from somebody who paid for it.
    const siteId = given({ paidThrough: IN_A_MONTH });
    state.users.push({
      id: "u-1",
      email: "a@example.com",
      plan_status: "canceled",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      paid_through: IN_A_MONTH.toISOString(),
      cancelled_at: NOW.toISOString(),
      last_subscription_event_id: null,
      deleted_at: null,
    });
    expect(await hasActiveAccess(siteId)).toBe(true);
  });

  it("a past_due subscription with a future paid_through HAS access", async () => {
    // REQ-076 c8: "whether or not its latest renewal was paid". A bounced
    // card does not move `paid_through`, so it does not move the gate.
    const siteId = given({ paidThrough: IN_A_MONTH });
    state.users.push({
      id: "u-1",
      email: "a@example.com",
      plan_status: "past_due",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      paid_through: IN_A_MONTH.toISOString(),
      cancelled_at: null,
      last_subscription_event_id: null,
      deleted_at: null,
    });
    expect(await hasActiveAccess(siteId)).toBe(true);
  });

  it("a subscription Stripe still calls active with a past paid_through has NONE", async () => {
    const siteId = given({ paidThrough: LAST_MONTH });
    state.users.push({
      id: "u-1",
      email: "a@example.com",
      plan_status: "active",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      paid_through: LAST_MONTH.toISOString(),
      cancelled_at: null,
      last_subscription_event_id: null,
      deleted_at: null,
    });
    expect(await hasActiveAccess(siteId)).toBe(false);
  });
});

describe("REQ-076 c4 — the gate turns false at the instant the date passes", () => {
  it("true one millisecond before, false at the instant itself", async () => {
    const siteId = given({ paidThrough: NOW });

    vi.setSystemTime(new Date(NOW.getTime() - 1));
    expect(await hasActiveAccess(siteId)).toBe(true);

    // The boundary is exclusive: `paid_through > now()`, so the instant
    // itself is not access.
    vi.setSystemTime(NOW);
    expect(await hasActiveAccess(siteId)).toBe(false);

    vi.setSystemTime(new Date(NOW.getTime() + 1));
    expect(await hasActiveAccess(siteId)).toBe(false);
  });
});

describe("the gate fails closed", () => {
  it("a site that does not exist has no access", async () => {
    expect(await hasActiveAccess("site-nobody")).toBe(false);
  });

  it("a store that cannot be read has no access", async () => {
    given({ paidThrough: IN_A_MONTH });
    state.failHostingRead = true;
    // Three loops spend money on a `true`. Spending a departed customer's
    // money because a read failed is the worse of the two errors.
    expect(await hasActiveAccess("site-1")).toBe(false);
  });
});
