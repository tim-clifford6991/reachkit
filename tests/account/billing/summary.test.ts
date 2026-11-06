// tests/account/billing/summary.test.ts — REQ-076 c1; REQ-097 c1, c5
//
// What the Settings billing card reads, and — the point of the suite —
// what it cannot read. REQ-097 criterion 5 keeps the next invoice, the
// card and the invoice history off every ReachKit surface, and the owner's
// ruling on this issue settled which of §4.7's four things survive that:
// the plan, the price and the control.
//
// The discriminating case is the last one: `billingSummary` makes no vendor
// call at all. A summary that reached Stripe would be a summary with
// something on it to go stale.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { billingSummary, setBillingStore } = await import("@/lib/account/billing");
const { PRICE_COPY_KEYS } = await import("@/lib/account/checkout/copy-keys");
const { setStripe } = await import("@/lib/account/stripe/client");
const { COPY } = await import("@/lib/presentation/copy");
const { memoryBillingStore, newMemoryBilling, account } = await import("./memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let state = newMemoryBilling();
let vendor = newStripeDouble();
const PAID_THROUGH = new Date("2026-10-01T00:00:00.000Z");

beforeEach(() => {
  state = newMemoryBilling();
  vendor = newStripeDouble();
  setBillingStore(memoryBillingStore(state));
  setStripe(stripeDouble(vendor));
});

afterEach(() => {
  setBillingStore(null);
  setStripe(null);
});

describe("REQ-076 c1 — what the card reads", () => {
  it("the plan, the price keys, the access-end date and the one destination", async () => {
    state.users.push(
      account({ id: "u1", paid_through: PAID_THROUGH.toISOString(), plan_status: "active" })
    );
    const result = await billingSummary("u1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary).toEqual({
      state: "active",
      planKey: "plan.single",
      priceKeys: PRICE_COPY_KEYS,
      paidThrough: PAID_THROUGH,
      cancelledAt: null,
      planStatus: "active",
      invoicesVia: "portal",
    });
  });

  it("the plan and the price are copy keys that resolve", async () => {
    // REQ-097's own non-goal keeps "€49/mo" a public product fact stated on
    // every price surface, spoken through the same three keys the report's
    // pricing card and /pricing use — so the price cannot be stated twice.
    state.users.push(account({ id: "u1" }));
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.summary.planKey in COPY).toBe(true);
    for (const key of result.summary.priceKeys) expect(key in COPY).toBe(true);
  });

  it("dates are instants, never formatted", async () => {
    // The customer's own stated zone is applied at render (REQ-073 c3). A
    // date formatted here would be formatted in the server's zone and be
    // wrong for every customer who is not in it.
    state.users.push(account({ id: "u1", paid_through: PAID_THROUGH.toISOString() }));
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.summary.paidThrough).toBeInstanceOf(Date);
    expect(JSON.stringify(result.summary)).not.toMatch(/Oct(ober)?/);
  });
});

describe("REQ-097 c5 — no billing value is on the summary at all", () => {
  it("there is no next invoice, no card and no invoice history", async () => {
    state.users.push(account({ id: "u1" }));
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    const keys = Object.keys(result.summary);
    for (const absent of ["nextInvoice", "card", "invoices", "amountCents", "last4", "brand"]) {
      expect(keys, absent).not.toContain(absent);
    }
  });

  it("the invoices are the portal's, named as a literal", async () => {
    // REQ-097 c1's one destination. A literal, so a call site cannot
    // introduce a second.
    state.users.push(account({ id: "u1" }));
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.summary.invoicesVia).toBe("portal");
  });

  it("the summary makes no vendor call — there is nothing on it Stripe holds", async () => {
    state.users.push(account({ id: "u1" }));
    await billingSummary("u1");
    expect(vendor.portalSessions).toHaveLength(0);
    expect(vendor.created).toHaveLength(0);
    expect(vendor.subscriptionUpdates).toHaveLength(0);
    expect(vendor.chargesCreated).toBe(0);
  });
});

describe("the plan state, and ADR-050", () => {
  it("state is `cancelled_at`, not a comparison against paid_through", async () => {
    // A cancelled customer inside their paid period still has access, so a
    // card that read the gate would offer them a cancel control they had
    // already used.
    state.users.push(
      account({
        id: "u1",
        cancelled_at: "2026-09-06T00:00:00.000Z",
        paid_through: PAID_THROUGH.toISOString(),
      })
    );
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.summary.state).toBe("cancelled");
    expect(result.summary.paidThrough).toEqual(PAID_THROUGH);
  });

  it("plan_status is carried for display and decides nothing here", async () => {
    // ADR-050: recorded, and read by no gate. `past_due` does not change
    // the state the card offers a control for.
    state.users.push(account({ id: "u1", plan_status: "past_due", cancelled_at: null }));
    const result = await billingSummary("u1");
    if (!result.ok) throw new Error("unreachable");
    expect(result.summary.planStatus).toBe("past_due");
    expect(result.summary.state).toBe("active");
  });
});

describe("what it says when it cannot answer", () => {
  it("no account is `no_account`, and a store that is down is `store`", async () => {
    expect(await billingSummary("nobody")).toEqual({ ok: false, reason: "no_account" });
    state.failAccountRead = true;
    expect(await billingSummary("u1")).toEqual({ ok: false, reason: "store" });
  });
});
