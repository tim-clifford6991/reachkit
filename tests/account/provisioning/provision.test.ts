// tests/account/provisioning/provision.test.ts — BUILD §13, issue #33
//
// §13's own sentence, in order: "upsert user, create site (domain null if
// scanless — asked at setup), stamp lead converted, queue deep pass, send
// magic link → /setup." This suite asserts each clause and the order the
// two time-bound ones stand in — the link before the pass, because REQ-024
// criterion 1 gives the link 60 seconds and a deep pass is minutes.
//
// The sign-in link arrives through its registered issuer, which is issue
// #35's to supply. Both states are exercised: an issuer registered (the
// mail goes) and none (no mail, and the account still opens).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { provisionFromPayment } = await import("@/lib/account/provisioning/provision");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { registerDeepPassQueue } = await import("@/lib/account/provisioning/deep-pass");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { memoryStore, newMemoryState } = await import("../../mail/leads/memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();
/** Every effect, in the order it happened. The order is the assertion. */
let happened: string[] = [];

function completedSession(patch: Record<string, unknown> = {}) {
  return {
    id: "cs_one",
    status: "complete",
    customer: "cus_one",
    customer_details: {
      email: "founder@acme.example",
      address: { country: "IE" },
      tax_ids: [{ type: "eu_vat", value: "IE1234567X" }],
    },
    metadata: { originKind: "report", scanId: "scan-done" },
    ...patch,
  };
}

beforeEach(() => {
  happened = [];
  accounts = newMemoryAccounts();
  accounts.scans.set("scan-done", { status: "done", domain: "acme.example" });
  accounts.leads.push({ email: "Founder@Acme.example", converted_at: null });
  setAccountStore(memoryAccountStore(accounts));
  setLeadStore(memoryStore(newMemoryState()));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };

  vendor = newStripeDouble();
  vendor.sessions.set("cs_one", completedSession());
  setStripe(stripeDouble(vendor));

  registerSignInLinkIssuer(async (a) => {
    happened.push(`link:${a.to}`);
    return { issued: true, url: "https://reachkit.example/signin?t=tok", expiresAt: new Date() };
  });
  registerDeepPassQueue(async (request) => {
    happened.push(`deep-pass:${request.domain}`);
  });
});

afterEach(() => {
  registerSignInLinkIssuer(null);
  registerDeepPassQueue(null);
  setLeadStore(null);
  vi.restoreAllMocks();
});

describe("§13 — one verified completed payment becomes one account, one site, one subscription", () => {
  it("opens exactly one account, carrying the facts the session collected", async () => {
    const result = await provisionFromPayment("cs_one");
    expect(result.created).toBe(true);
    expect(accounts.users).toHaveLength(1);
    expect(accounts.users[0]).toMatchObject({
      email: "founder@acme.example",
      checkout_session_id: "cs_one",
      stripe_customer_id: "cus_one",
      billing_country: "IE",
      vat_number: "IE1234567X",
    });
  });

  it("creates exactly one site, for the domain the report measured", async () => {
    await provisionFromPayment("cs_one");
    expect(accounts.sites).toHaveLength(1);
    expect(accounts.sites[0]).toMatchObject({
      domain: "acme.example",
      provisioned_from_scan_id: "scan-done",
    });
  });

  it("stamps the lead converted, matching the address case-insensitively", async () => {
    await provisionFromPayment("cs_one");
    expect(accounts.leads[0]?.converted_at).not.toBeNull();
  });
});

describe('REQ-024 c1 — "a sign-in link to setup is sent to the address that paid, within 60 seconds, with no further action by the founder"', () => {
  it("the link is issued to the address that paid and the magic-link mail goes to it", async () => {
    const result = await provisionFromPayment("cs_one");
    expect(happened).toContain("link:founder@acme.example");
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({ kind: "magic-link", to: "founder@acme.example" });
    expect(result.signIn).toEqual({ sent: true });
  });

  it("the deep pass is queued after the link, never before it", async () => {
    await provisionFromPayment("cs_one");
    const link = happened.indexOf("link:founder@acme.example");
    const pass = happened.findIndex((step) => step.startsWith("deep-pass:"));
    expect(link).toBeGreaterThanOrEqual(0);
    expect(pass).toBeGreaterThan(link);
  });

  it("the deep pass is never awaited — provisioning returns while it hangs", async () => {
    let release = () => {};
    registerDeepPassQueue(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    // A queue that never settles must not hold the founder's account open.
    await expect(provisionFromPayment("cs_one")).resolves.toMatchObject({ created: true });
    release();
  });

  it("no credential of any other kind is created — no password column is written", async () => {
    await provisionFromPayment("cs_one");
    const written = Object.keys(accounts.users[0] ?? {});
    expect(written.some((key) => /password|secret|token/i.test(key))).toBe(false);
  });
});

describe("the sign-in link's issuer is issue #35's, and provisioning is honest about not having one", () => {
  it("with no issuer registered, the account still opens and no mail claims a link", async () => {
    registerSignInLinkIssuer(null);
    const result = await provisionFromPayment("cs_one");
    expect(result.created).toBe(true);
    expect(result.signIn).toEqual({ sent: false, because: "no_link" });
    // No mail at all: a magic-link mail whose action points nowhere is
    // worse than a late one, because the founder spends their attempt on it.
    expect(sendCalls).toEqual([]);
  });
});

describe('§13 — "create site (domain null if scanless — asked at setup)"', () => {
  it("a scanless purchase makes a site with no domain", async () => {
    vendor.sessions.set("cs_one", completedSession({ metadata: { originKind: "pricing" } }));
    await provisionFromPayment("cs_one");
    expect(accounts.sites[0]).toMatchObject({ domain: null, provisioned_from_scan_id: null });
  });

  it("and queues no deep pass — there is nothing to run it against yet", async () => {
    vendor.sessions.set("cs_one", completedSession({ metadata: { originKind: "pricing" } }));
    await provisionFromPayment("cs_one");
    expect(happened.some((step) => step.startsWith("deep-pass:"))).toBe(false);
  });

  it("and takes no domain from the address they paid with (REQ-021 c7)", async () => {
    vendor.sessions.set("cs_one", completedSession({ metadata: { originKind: "pricing" } }));
    await provisionFromPayment("cs_one");
    expect(accounts.sites[0]?.domain).toBeNull();
    expect(JSON.stringify(accounts.sites[0])).not.toContain("acme.example");
  });
});

describe('REQ-024 c2 — a payment that did not complete results in nothing', () => {
  it("no account, no site, no lead stamp and no mail", async () => {
    vendor.sessions.set("cs_one", completedSession({ status: "open" }));
    const result = await provisionFromPayment("cs_one");
    expect(result).toMatchObject({ created: false, refused: "session_not_complete" });
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
    expect(accounts.leads[0]?.converted_at).toBeNull();
    expect(happened).toEqual([]);
    expect(sendCalls).toEqual([]);
  });
});

describe("what provisioning logs", () => {
  it("names the session and the outcome, and no address, country or VAT number", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => void lines.push(String(line));
    try {
      await provisionFromPayment("cs_one");
    } finally {
      console.log = original;
    }
    const emitted = lines.filter((line) => line.includes('"event":"provision"')).join("\n");
    expect(emitted).toContain("cs_one");
    expect(emitted).not.toContain("founder@acme.example");
    expect(emitted).not.toContain("IE1234567X");
  });
});
