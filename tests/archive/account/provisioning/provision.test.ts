// tests/account/provisioning/provision.test.ts — BUILD §13, issue #33
//
// §13's own sentence, in order: "upsert user, create site (domain null if
// scanless — asked at setup), stamp lead converted, send magic link →
// /setup." This suite asserts each clause.
//
// The sign-in link arrives through its registered issuer, which is issue
// #35's to supply. Both states are exercised: an issuer registered (the
// mail goes) and none (no mail, and the account still opens).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

// Setup starts the onboarding pass once rivals are confirmed; a payment must not.
const jobEvents: string[] = [];
vi.mock("@/jobs/client", async () =>
  (await import("../../journeys/harness")).jobsClient((name) => void jobEvents.push(name))
);

const { provisionFromPayment } = await import("@/lib/account/provisioning/provision");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { memoryStore, newMemoryState } = await import("../../mail/leads/memory-store");
const { newStripeDouble, stripeDouble, stripeErrors, subscriptionDouble } = await import("../stripe-double");
const { setBillingStore } = await import("@/lib/account/billing");
const { account, memoryBillingStore, newMemoryBilling } = await import("../billing/memory-store");
const { setOfferStore } = await import("@/lib/account/offer/spots");
const { memoryOfferStore } = await import("../offer-store");

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
  jobEvents.length = 0;
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
});

afterEach(() => {
  registerSignInLinkIssuer(null);
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

  it("a report purchase opens the user, the site and the link, and starts no scan/run", async () => {
    await expect(provisionFromPayment("cs_one")).resolves.toMatchObject({ created: true, signIn: { sent: true } });
    expect(accounts.sites).toHaveLength(1);
    expect(jobEvents).not.toContain("scan/run");
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

describe("a payment whose subscription did not open", () => {
  it("asks for a redelivery, and the redelivery opens it rather than leaving the buyer unpaid", async () => {
    const billing = newMemoryBilling();
    setBillingStore(memoryBillingStore(billing));
    const periodEnd = new Date("2026-12-20T00:00:00.000Z");
    vendor.sessions.set("cs_one", completedSession({ subscription: "sub_1" }));
    vendor.subscriptions.set("sub_1", subscriptionDouble({ id: "sub_1", customer: "cus_one", periodEnd }));
    vendor.subscriptionRetrieveError = stripeErrors.unavailable();
    expect((await provisionFromPayment("cs_one")).retry).toBe(true);

    billing.users.push(account({ id: accounts.users[0]?.id ?? "", paid_through: new Date(0).toISOString() }));
    vendor.subscriptionRetrieveError = null;
    expect(await provisionFromPayment("cs_one")).toMatchObject({ duplicate: "replay", retry: false });
    expect(billing.users[0]?.paid_through).toBe(periodEnd.toISOString());
    setBillingStore(null);
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

describe("the first-50 offer: a live paid checkout takes the lowest free place; provisioning never waits on it", () => {
  const spot = (place: number, freed = false) => ({ place, user_id: `u${place}`, subscription_id: `sub_${place}`, taken_at: new Date(), freed_at: freed ? new Date() : null });
  const buy = async (id: string, email = `${id}@x.example`, livemode = true, paidAt?: Date) => (vendor.sessions.set(id, completedSession({ id, livemode, subscription: `sub_${id}`, customer_details: { email } })), (await provisionFromPayment(id, paidAt)).userId !== null);
  afterEach(() => (vi.useRealTimers(), setOfferStore(null)));

  it("one spot per checkout, none for a return, the 51st, an owner or test mode; a replay repairs a failed write; each account opens", async () => {
    const [rows, fail] = [[spot(1), spot(2, true)], { next: true }];
    setOfferStore(memoryOfferStore(rows, fail));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const opened = [await buy("cs_one", "founder@acme.example")];
    const failLogged = log.mock.calls.flat().join().includes("offer_spot_failed") && rows.length === 2;
    fail.next = false;
    opened.push(await buy("cs_one", "founder@acme.example"), await buy("cs_one", "founder@acme.example"), await buy("cs_back", "founder@acme.example"), await buy("cs_owner", "Owner@Example.com"), await buy("cs_test", undefined, false));
    expect(rows.map((r) => r.place)).toEqual([1, 2, 2]);
    rows.push(...Array.from({ length: 48 }, (_, i) => spot(i + 3)));
    opened.push(await buy("cs_51"));
    expect({ opened: opened.every(Boolean), rows: rows.length, failLogged }).toEqual({ opened: true, rows: 51, failLogged: true });
  });

  it("the end is judged by when the buyer paid; a buyer who loses a place to a concurrent one reads again, and the cap holds", async () => {
    const rows = [spot(1)];
    setOfferStore(memoryOfferStore(rows));
    vi.useFakeTimers({ now: new Date("2027-02-01T00:00:05Z"), toFake: ["Date"] });
    await buy("cs_late");
    await buy("cs_paid_before", undefined, true, new Date("2027-01-31T23:59:59Z"));
    expect(rows.map((r) => r.subscription_id)).toEqual(["sub_1", "sub_cs_paid_before"]);
    vi.useRealTimers();
    for (const held of [48, 49]) {
      rows.splice(0, rows.length, ...Array.from({ length: held }, (_, i) => spot(i + 1)));
      const store = memoryOfferStore(rows);
      let stale = true;
      // The first read is taken before a rival buyer inserts the next free place.
      setOfferStore({ ...store, heldPlaces: async () => { const read = await store.heldPlaces(); if (stale) rows.push(spot(held + 1)); stale = false; return read; } });
      expect(await buy(`cs_race_${held}`)).toBe(true);
      expect(rows.filter((r) => r.subscription_id === `sub_cs_race_${held}`).map((r) => r.place)).toEqual(held === 48 ? [50] : []);
      expect(rows.filter((r) => r.freed_at === null).length).toBeLessThanOrEqual(50);
    }
  });
});
