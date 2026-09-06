// tests/account/provisioning/backstop.test.ts — BUILD §13, issue #33
//
// REQ-024 criterion 6: twenty-four hours after a payment against which no
// account opened, "an account is open against that payment and a sign-in
// link to it has been sent to the address that paid, with no second charge
// and nothing required of the founder beyond opening that link."
//
// `chargesCreated` and `created` on the vendor double are what make "no
// second charge" observable: a counter nothing increments is the only way
// to see that a charge did not happen, as opposed to happening and being
// swallowed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { backstopProvision } = await import("@/lib/account/provisioning/backstop");
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
let links = 0;

beforeEach(() => {
  links = 0;
  accounts = newMemoryAccounts();
  accounts.scans.set("scan-done", { status: "done", domain: "acme.example" });
  setAccountStore(memoryAccountStore(accounts));
  setLeadStore(memoryStore(newMemoryState()));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };

  vendor = newStripeDouble();
  vendor.sessions.set("cs_orphan", {
    id: "cs_orphan",
    status: "complete",
    customer: "cus_one",
    subscription: "sub_one",
    customer_details: { email: "founder@acme.example", address: { country: "IE" }, tax_ids: [] },
    metadata: { originKind: "report", scanId: "scan-done" },
  });
  setStripe(stripeDouble(vendor));

  registerSignInLinkIssuer(async () => {
    links += 1;
    return { issued: true, url: "https://reachkit.example/signin?t=tok", expiresAt: new Date() };
  });
  registerDeepPassQueue(async () => {});
});

afterEach(() => {
  registerSignInLinkIssuer(null);
  registerDeepPassQueue(null);
  setLeadStore(null);
});

describe("an account and a link exist after the backstop", () => {
  it("opens the account from the session that already paid", async () => {
    const outcome = await backstopProvision("cs_orphan");
    expect(outcome).toEqual({ provisioned: true, replay: false });
    expect(accounts.users).toHaveLength(1);
    expect(accounts.users[0]).toMatchObject({ checkout_session_id: "cs_orphan" });
    expect(accounts.sites).toHaveLength(1);
  });

  it("sends the sign-in link to the address that paid", async () => {
    await backstopProvision("cs_orphan");
    expect(links).toBe(1);
    expect(sendCalls[0]).toMatchObject({ kind: "magic-link", to: "founder@acme.example" });
  });
});

describe('REQ-024 c6 — "with no second charge"', () => {
  it("no charge is created and no checkout session is created", async () => {
    await backstopProvision("cs_orphan");
    expect(vendor.chargesCreated).toBe(0);
    expect(vendor.created).toEqual([]);
  });

  it("and nothing is cancelled either — this payment is the one that stands", async () => {
    await backstopProvision("cs_orphan");
    expect(vendor.cancelled).toEqual([]);
  });
});

describe("running twice provisions once", () => {
  it("the second run takes the replay branch and creates nothing", async () => {
    await backstopProvision("cs_orphan");
    const second = await backstopProvision("cs_orphan");
    expect(second).toEqual({ provisioned: true, replay: true });
    expect(accounts.users).toHaveLength(1);
    expect(accounts.sites).toHaveLength(1);
    expect(links).toBe(1);
  });
});

describe("the firing is itself the alert", () => {
  it("a warning names the session and says what the firing means", async () => {
    const lines: string[] = [];
    const original = console.warn;
    console.warn = (line: string) => void lines.push(String(line));
    try {
      await backstopProvision("cs_orphan");
    } finally {
      console.warn = original;
    }
    const alert = lines.find((line) => line.includes("provisioning_backstop_fired"));
    expect(alert).toBeDefined();
    expect(alert).toContain("cs_orphan");
  });

  it("emitted exactly once per firing", async () => {
    const lines: string[] = [];
    const original = console.warn;
    console.warn = (line: string) => void lines.push(String(line));
    try {
      await backstopProvision("cs_orphan");
    } finally {
      console.warn = original;
    }
    expect(lines.filter((line) => line.includes("provisioning_backstop_fired"))).toHaveLength(1);
  });
});

describe("a session that cannot be provisioned is reported, never silently dropped", () => {
  it("a session that did not complete names why", async () => {
    vendor.sessions.set("cs_open", {
      id: "cs_open",
      status: "open",
      customer: "cus_two",
      customer_details: { email: "someone@acme.example" },
      metadata: {},
    });
    const outcome = await backstopProvision("cs_open");
    expect(outcome).toEqual({ provisioned: false, because: "session_not_complete" });
    expect(accounts.users).toEqual([]);
  });
});
