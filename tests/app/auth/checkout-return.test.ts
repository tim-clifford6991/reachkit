// tests/app/auth/checkout-return.test.ts — SPEC.md §3 (2026-09-14)
//
// GET /auth/checkout?session_id=…: Stripe's success URL. The buyer has
// paid and has no session yet. The route provisions (idempotent with the
// webhook), signs them in, and sends a first-time payer to `/setup`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { GET } = await import("../../../src/app/(public)/auth/checkout/route");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import(
  "../../account/identity/memory-store"
);
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth } = await import(
  "../../account/identity/fake-auth"
);
const { setAccountStore } = await import("../../../src/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../../account/memory-store");
const { setStripe } = await import("../../../src/lib/account/stripe/client");
const { newStripeDouble, stripeDouble } = await import("../../account/stripe-double");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { memoryStore, newMemoryState } = await import("../../mail/leads/memory-store");
const { registerDeepPassQueue } = await import("../../../src/lib/account/provisioning/deep-pass");
const { registerSignInLinkIssuer } = await import("../../../src/lib/account/provisioning/sign-in-link");
const { wireSignInLinkIssuer, unwireSignInLinkIssuer } = await import(
  "../../../src/lib/account/identity/wire"
);

const ORIGIN = "https://reachkit.example";
const EMAIL = "founder@acme.example";
const SESSION_ID = "cs_paid";

let accounts = newMemoryAccounts();
let identity = newMemoryIdentity();
let auth = newFakeAuth();
let vendor = newStripeDouble();

function paidSession() {
  return {
    id: SESSION_ID,
    status: "complete",
    customer: "cus_one",
    customer_details: {
      email: EMAIL,
      address: { country: "DE" },
      tax_ids: [],
    },
    metadata: { originKind: "pricing" },
  };
}

beforeEach(() => {
  accounts = newMemoryAccounts();
  identity = newMemoryIdentity();
  auth = newFakeAuth();
  vendor = newStripeDouble();
  vendor.sessions.set(SESSION_ID, paidSession());
  setAccountStore(memoryAccountStore(accounts));
  setIdentityStore(memoryIdentityStore(identity));
  setIdentityAuth(fakeIdentityAuth(auth));
  setLeadStore(memoryStore(newMemoryState()));
  setStripe(stripeDouble(vendor));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  registerDeepPassQueue(async () => undefined);
  wireSignInLinkIssuer();
  addAccount(identity, { id: "user-1", email: EMAIL });
  addAuthUser(auth, { id: "user-1", email: EMAIL });
});

afterEach(() => {
  registerDeepPassQueue(null);
  registerSignInLinkIssuer(null);
  unwireSignInLinkIssuer();
  setLeadStore(null);
});

async function open(url: string): Promise<NextResponse> {
  return GET(new NextRequest(url));
}

function locationOf(response: NextResponse): URL {
  return new URL(response.headers.get("location") ?? "");
}

describe("a completed payment signs the buyer in and sends them to setup", () => {
  it("lands on /setup with the session cookie", async () => {
    const response = await open(`${ORIGIN}/auth/checkout?session_id=${SESSION_ID}`);
    expect(locationOf(response).pathname).toBe("/setup");
    const cookie = response.cookies.get(FAKE_AUTH_COOKIE);
    expect(cookie).toBeDefined();
    expect(auth.sessions.find((s) => s.accessToken === cookie?.value)?.userId).toBe("user-1");
    expect(accounts.users).toHaveLength(1);
  });

  it("a returning customer who already signed in goes to /app, not setup", async () => {
    identity.users[0] = { ...identity.users[0]!, first_signed_in_at: new Date("2026-01-01").toISOString() };
    const response = await open(`${ORIGIN}/auth/checkout?session_id=${SESSION_ID}`);
    expect(locationOf(response).pathname).toBe("/app");
  });
});

describe("a session that is not a completed payment returns to the offer", () => {
  it.each([
    ["no session id", `${ORIGIN}/auth/checkout`],
    ["the unreplaced Stripe placeholder", `${ORIGIN}/auth/checkout?session_id={CHECKOUT_SESSION_ID}`],
  ])("%s", async (_name, url) => {
    const response = await open(url);
    expect(locationOf(response).pathname).toBe("/pricing");
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeUndefined();
    expect(accounts.users).toEqual([]);
  });

  it("an unpaid session opens nothing and returns to /pricing", async () => {
    vendor.sessions.set(SESSION_ID, { ...paidSession(), status: "open" });
    const response = await open(`${ORIGIN}/auth/checkout?session_id=${SESSION_ID}`);
    expect(locationOf(response).pathname).toBe("/pricing");
    expect(accounts.users).toEqual([]);
  });
});
