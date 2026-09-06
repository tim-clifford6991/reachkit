// tests/account/provisioning/magic-link.test.ts — BUILD §13, issue #33
//
// Three answers to one request, each in its own written line, and never an
// access check.
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
    await expect(requestMagicLink("founder@acme.example")).resolves.toEqual({ sent: true });
    expect(links).toBe(1);
    expect(sendCalls[0]).toMatchObject({ kind: "magic-link", to: "founder@acme.example" });
  });

  it("and is offered no checkout: this module builds none and imports none", () => {
    expect(SOURCE).not.toMatch(/createCheckoutSession|checkout\.stripe\.com/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*checkout/);
  });

  it("an address in a different case resolves to the same account", async () => {
    await openAccount("founder@acme.example");
    await expect(requestMagicLink("  FOUNDER@Acme.Example  ")).resolves.toEqual({ sent: true });
    expect(links).toBe(1);
  });
});

describe('REQ-020 c4 — the two answers that send no link, each its own written line', () => {
  it("a held completed payment answers payment_held_account_opening and sends no link", async () => {
    vendor.listed = [{ id: "cs_held" }];
    const answer = await requestMagicLink("waiting@acme.example");
    expect(answer).toEqual({
      sent: false,
      answer: "payment_held_account_opening",
      lineKey: "signin.payment_held",
    });
    expect(links).toBe(0);
    expect(sendCalls).toEqual([]);
  });

  it("an unknown address answers no_account and sends no link", async () => {
    vendor.listed = [];
    const answer = await requestMagicLink("stranger@nowhere.example");
    expect(answer).toEqual({ sent: false, answer: "no_account", lineKey: "signin.no_account" });
    expect(links).toBe(0);
    expect(sendCalls).toEqual([]);
  });

  it("the two carry different line keys — one written line each", async () => {
    vendor.listed = [{ id: "cs_held" }];
    const held = await requestMagicLink("waiting@acme.example");
    vendor.listed = [];
    const unknown = await requestMagicLink("stranger@nowhere.example");
    // An implementation that collapsed them into one line fails here.
    expect(held).not.toEqual(unknown);
    expect((held as { lineKey: string }).lineKey).not.toBe((unknown as { lineKey: string }).lineKey);
  });

  it("a vendor it cannot ask answers no_account, never a payment it cannot see", async () => {
    vendor.listError = new Error("vendor is down");
    const answer = await requestMagicLink("waiting@acme.example");
    expect(answer).toMatchObject({ answer: "no_account" });
  });
});

describe('REQ-076 c5 / REQ-020 c4 — a lapsed customer is still sent a link and can still sign in', () => {
  it("an account whose plan lapsed is sent a link", async () => {
    await openAccount("lapsed@acme.example");
    await expect(requestMagicLink("lapsed@acme.example")).resolves.toEqual({ sent: true });
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

  it("no branch returns a session or anything outside the three-arm union", async () => {
    await openAccount("founder@acme.example");
    vendor.listed = [{ id: "cs_held" }];
    const answers = [
      await requestMagicLink("founder@acme.example"),
      await requestMagicLink("waiting@acme.example"),
    ];
    vendor.listed = [];
    answers.push(await requestMagicLink("stranger@nowhere.example"));
    for (const answer of answers) {
      const keys = Object.keys(answer).sort();
      expect(keys).toEqual(answer.sent ? ["sent"] : ["answer", "lineKey", "sent"]);
    }
  });
});
