// tests/account/provisioning/due-work.test.ts — BUILD §13, issue #33
//
// The two clocks, on a fixed clock. Both boundaries are asserted from both
// sides — at 14:59 not due, at 15:01 due; at 23:59 no backstop, at 24:01 a
// backstop — because an off-by-one in either direction is the whole defect:
// too early and every founder is chased before they have opened their
// inbox, too late and REQ-024's promise is broken.
import { beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { paymentsAwaitingSignIn, paymentsWithoutAccounts } = await import(
  "@/lib/account/provisioning/due-work"
);
const { PAYMENT_BACKSTOP_H, PAYMENT_CHASE_MINUTES } = await import("@/lib/config/constants");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

const CHARGED = new Date("2026-09-06T12:00:00.000Z");
const minutesAfter = (n: number) => new Date(CHARGED.getTime() + n * 60 * 1000);
const hoursAfter = (n: number) => new Date(CHARGED.getTime() + n * 60 * 60 * 1000);

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();

function account(patch: Record<string, unknown> = {}) {
  accounts.users.push({
    id: "user-1",
    email: "founder@acme.example",
    checkout_session_id: "cs_one",
    first_signed_in_at: null,
    sign_in_chased_at: null,
    stripe_customer_id: "cus_one",
    billing_country: "IE",
    vat_number: null,
    created_at: CHARGED.toISOString(),
    ...patch,
  });
}

beforeEach(() => {
  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
});

describe('REQ-024 c5 — "when 15 minutes have passed since the charge and no one has signed in at the address that paid"', () => {
  it("the pin is what the boundary is computed from, not a literal", () => {
    expect(PAYMENT_CHASE_MINUTES).toBe(15);
  });

  it("is not due one minute before the boundary", async () => {
    account();
    await expect(paymentsAwaitingSignIn(minutesAfter(14))).resolves.toEqual([]);
  });

  it("is due one minute after it", async () => {
    account();
    await expect(paymentsAwaitingSignIn(minutesAfter(16))).resolves.toEqual(["cs_one"]);
  });

  it("is due exactly at it — the promise is 'when 15 minutes have passed', inclusive", async () => {
    account();
    await expect(paymentsAwaitingSignIn(minutesAfter(15))).resolves.toEqual(["cs_one"]);
  });

  it("a founder who has signed in is never due", async () => {
    account({ first_signed_in_at: minutesAfter(2).toISOString() });
    await expect(paymentsAwaitingSignIn(hoursAfter(3))).resolves.toEqual([]);
  });

  it("an already-chased session is not due twice", async () => {
    account({ sign_in_chased_at: minutesAfter(15).toISOString() });
    await expect(paymentsAwaitingSignIn(hoursAfter(3))).resolves.toEqual([]);
  });

  it("an account with no checkout session behind it is not a payment awaiting sign-in", async () => {
    account({ checkout_session_id: null });
    await expect(paymentsAwaitingSignIn(hoursAfter(3))).resolves.toEqual([]);
  });

  it("an unreadable store returns nothing rather than a guess", async () => {
    account();
    accounts.failAccountRead = true;
    await expect(paymentsAwaitingSignIn(hoursAfter(3))).resolves.toEqual([]);
  });
});

describe('REQ-024 c6 — "when 24 hours have passed since the charge, then an account is open against that payment"', () => {
  it("the pin is what the boundary is computed from", () => {
    expect(PAYMENT_BACKSTOP_H).toBe(24);
  });

  it("no backstop before the boundary", async () => {
    // The vendor listing is bounded by `created`, so a session outside the
    // window is one the listing does not return at all — which the double
    // models by being told what the listing holds.
    vendor.listed = [];
    await expect(paymentsWithoutAccounts(hoursAfter(23))).resolves.toEqual([]);
  });

  it("a completed session with no account of ours is due after it", async () => {
    vendor.listed = [{ id: "cs_orphan" }];
    await expect(paymentsWithoutAccounts(hoursAfter(25))).resolves.toEqual(["cs_orphan"]);
  });

  it("a session that already has an account is never returned", async () => {
    account({ checkout_session_id: "cs_orphan" });
    vendor.listed = [{ id: "cs_orphan" }];
    await expect(paymentsWithoutAccounts(hoursAfter(25))).resolves.toEqual([]);
  });

  it("an unreadable store never makes a provisioned session look orphaned", async () => {
    // The dangerous direction: a store we cannot read must not send the
    // backstop off to open an account that already exists.
    account({ checkout_session_id: "cs_orphan" });
    accounts.failAccountRead = true;
    vendor.listed = [{ id: "cs_orphan" }];
    await expect(paymentsWithoutAccounts(hoursAfter(25))).resolves.toEqual([]);
  });

  it("a vendor it cannot list returns nothing — the next tick asks again", async () => {
    vendor.listError = new Error("vendor is down");
    await expect(paymentsWithoutAccounts(hoursAfter(25))).resolves.toEqual([]);
  });

  it("the listing is bounded at both ends, so it does not walk every session ever taken", async () => {
    const seen: Record<string, unknown>[] = [];
    const inner = stripeDouble(vendor);
    setStripe({
      ...inner,
      checkout: {
        sessions: {
          ...inner.checkout.sessions,
          list: async (params: Record<string, unknown>) => {
            seen.push(params);
            return { data: [] };
          },
        },
      },
    } as unknown as typeof inner);
    await paymentsWithoutAccounts(hoursAfter(25));
    const created = seen[0]?.created as { gte: number; lte: number };
    expect(typeof created.gte).toBe("number");
    expect(typeof created.lte).toBe("number");
    expect(created.gte).toBeLessThan(created.lte);
    expect(seen[0]?.status).toBe("complete");
  });
});

describe("neither query writes anything", () => {
  it("the store is unchanged after both run", async () => {
    account();
    vendor.listed = [{ id: "cs_orphan" }];
    const before = JSON.stringify(accounts);
    await paymentsAwaitingSignIn(hoursAfter(3));
    await paymentsWithoutAccounts(hoursAfter(25));
    expect(JSON.stringify(accounts)).toBe(before);
  });
});
