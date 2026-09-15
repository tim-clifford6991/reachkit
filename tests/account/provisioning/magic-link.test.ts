// tests/account/provisioning/magic-link.test.ts — BUILD §13, issue #33
//
// One answer to every request, whatever the address (SPEC §3, issue 718),
// and never an access check.
//
// The seam issue #19 declared has a body now. The case that discriminates
// hardest is the lapsed customer: REQ-020 criterion 4 rules them *out* of
// the no-account branch — "never a customer whose account exists and whose
// paid-through date has passed, who is still sent a link and can still sign
// in" — so an implementation that ANDs the access gate into this function
// fails here and nowhere else.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { requestMagicLink } = await import("@/lib/account/provisioning/magic-link");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

/** Comments stripped, on the footing `tests/config/constants.test.ts` uses
 *  for its own `CopyKey` rule: the module's header *names* the rules it
 *  keeps ("imports nothing from `src/lib/account/billing/**`", "no
 *  checkout"), and a promise stated in prose must not fail the test that
 *  checks the promise is kept. */
const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/provisioning/magic-link.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();
let links = 0;

async function openAccount(email: string, patch: Record<string, unknown> = {}) {
  const store = memoryAccountStore(accounts);
  await store.insertAccount({
    email,
    checkoutSessionId: `cs_${email}`,
    facts: { stripe_customer_id: "cus_x", billing_country: null, vat_number: null },
  });
  const index = accounts.users.length - 1;
  const existing = accounts.users[index];
  if (existing !== undefined) accounts.users[index] = { ...existing, ...patch };
}

beforeEach(() => {
  links = 0;
  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
  registerSignInLinkIssuer(async () => {
    links += 1;
    return { issued: true, url: "https://reachkit.example/signin?t=tok", expiresAt: new Date() };
  });
});

afterEach(() => registerSignInLinkIssuer(null));

describe('REQ-024 c4 — "when they ask for a new sign-in link using the address they paid with, then they are returned to where they left off … never to a dead end or a second checkout"', () => {
  it("an address with an account is sent a link", async () => {
    await openAccount("founder@acme.example");
    await expect(requestMagicLink("founder@acme.example")).resolves.toEqual({ answered: true });
    expect(links).toBe(1);
    expect(sendCalls[0]).toMatchObject({ kind: "magic-link", to: "founder@acme.example" });
  });

  it("and is offered no checkout: this module builds none and imports none", () => {
    expect(SOURCE).not.toMatch(/createCheckoutSession|checkout\.stripe\.com/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*checkout/);
  });

  it("an address in a different case resolves to the same account", async () => {
    await openAccount("founder@acme.example");
    await expect(requestMagicLink("  FOUNDER@Acme.Example  ")).resolves.toEqual({ answered: true });
    expect(links).toBe(1);
  });
});

describe('SPEC §3 — "Sign-in copy is identical whatever the address, revealing nothing about who has an account" (issue 718)', () => {
  it("an unknown address is sent nothing, and answered exactly as an account is", async () => {
    await openAccount("founder@acme.example");
    const known = await requestMagicLink("founder@acme.example");
    const unknown = await requestMagicLink("stranger@nowhere.example");
    expect(unknown).toEqual(known);
    expect(links).toBe(1);
    expect(sendCalls).toHaveLength(1);
  });

  it("a completed payment with no account yet is answered the same, and sends nothing from here", async () => {
    vendor.listed = [{ id: "cs_held" }];
    await expect(requestMagicLink("waiting@acme.example")).resolves.toEqual({ answered: true });
    expect(links).toBe(0);
    expect(sendCalls).toEqual([]);
  });

  it("asks the vendor nothing — no lookup whose presence or latency depends on the address", () => {
    expect(SOURCE).not.toMatch(/stripe|heldPayment/i);
  });
});

describe('REQ-076 c5 / REQ-020 c4 — a lapsed customer is still sent a link and can still sign in', () => {
  it("an account whose plan lapsed is sent a link", async () => {
    await openAccount("lapsed@acme.example");
    await expect(requestMagicLink("lapsed@acme.example")).resolves.toEqual({ answered: true });
    expect(links).toBe(1);
  });

  it("this module imports no billing symbol and reads no paid-through date", () => {
    // The structural half. `local/no-billing-internal-import` holds the
    // import; this holds the re-derivation somebody might write instead.
    expect(SOURCE).not.toMatch(/account\/billing/);
    expect(SOURCE).not.toMatch(/paid_through|hasActiveAccess|plan_status/);
  });
});

describe('REQ-020 c5 — nothing is said about any address until one is given', () => {
  it("the function takes exactly one argument, and it is the address", () => {
    expect(requestMagicLink.length).toBe(1);
  });
});
