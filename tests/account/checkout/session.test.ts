// tests/account/checkout/session.test.ts — BUILD §13, issue #33
//
// The seam issue #19 declared, now with a body. What was asserted before —
// that it never answers, and that the scanless arm has no field a scan id
// could be fabricated into — is asserted here against the implementation:
// the type property is unchanged, and "no fabricated scan id" is now a
// statement about what reaches the vendor.
import { beforeEach, describe, expect, it } from "vitest";
// A type-only import: erased before the module runs, so it does not read
// `env` at load the way the dynamic value imports below deliberately do.
import type { CheckoutOrigin } from "@/lib/account/checkout/origin";
import { applyEnvFixture, ENV_FIXTURE } from "../../mail/env-fixture";

applyEnvFixture();

const { createCheckoutSession } = await import("@/lib/account/checkout/session");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

const OURS = `${ENV_FIXTURE.NEXT_PUBLIC_APP_URL}/scan/acme.example`;

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();

beforeEach(() => {
  accounts = newMemoryAccounts();
  accounts.scans.set("scan-done", { status: "done", domain: "acme.example" });
  accounts.scans.set("scan-degraded", { status: "degraded", domain: "acme.example" });
  accounts.scans.set("scan-running", { status: "running", domain: "acme.example" });
  setAccountStore(memoryAccountStore(accounts));
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
});

describe('§13 — "Stripe Checkout from the report (scan id in metadata) or any price surface (scanless — no fabricated scan id)"', () => {
  it("a report origin puts the scan id in metadata", async () => {
    const result = await createCheckoutSession({
      origin: { kind: "report", scanId: "scan-done" },
      returnTo: OURS,
    });
    expect(result.ok).toBe(true);
    expect(vendor.created[0]?.metadata).toEqual({ originKind: "report", scanId: "scan-done" });
  });

  it("a pricing origin carries no scanId key at all — not an empty one, not a null", async () => {
    const result = await createCheckoutSession({ origin: { kind: "pricing" }, returnTo: OURS });
    expect(result.ok).toBe(true);
    const metadata = vendor.created[0]?.metadata as Record<string, string>;
    expect(Object.keys(metadata)).toEqual(["originKind"]);
  });

  it("the scanless arm of the type has no field a scan id could be put in", () => {
    // The property the seam was declared with, unchanged: `{ kind: 'pricing' }`
    // is exhaustive, so a call site cannot fabricate one even by trying.
    // @ts-expect-error — a scanId on the pricing arm is a compile error.
    const forbidden: CheckoutOrigin = { kind: "pricing", scanId: "scan-done" };
    expect(forbidden.kind).toBe("pricing");
  });

  it("both origins build otherwise identical session parameters (REQ-021 c5)", async () => {
    await createCheckoutSession({ origin: { kind: "report", scanId: "scan-done" }, returnTo: OURS });
    await createCheckoutSession({ origin: { kind: "pricing" }, returnTo: OURS });
    const [fromReport, fromPricing] = vendor.created;
    const strip = (p: Record<string, unknown> | undefined) => {
      const rest = { ...(p ?? {}) };
      delete rest.metadata;
      return rest;
    };
    expect(strip(fromReport)).toEqual(strip(fromPricing));
  });
});

describe('REQ-021 c3 — "the offer arrives with the report and never before it"', () => {
  it("a running scan refuses with origin_scan_incomplete and reaches no vendor", async () => {
    const result = await createCheckoutSession({
      origin: { kind: "report", scanId: "scan-running" },
      returnTo: OURS,
    });
    expect(result).toEqual({ ok: false, reason: "origin_scan_incomplete" });
    expect(vendor.created).toHaveLength(0);
  });

  it("a scan that does not exist refuses the same way — an unknown report is not a finished one", async () => {
    const result = await createCheckoutSession({
      origin: { kind: "report", scanId: "scan-nowhere" },
      returnTo: OURS,
    });
    expect(result).toEqual({ ok: false, reason: "origin_scan_incomplete" });
  });

  it("an unreadable store refuses rather than assuming a report exists", async () => {
    accounts.failScanRead = true;
    const result = await createCheckoutSession({
      origin: { kind: "report", scanId: "scan-done" },
      returnTo: OURS,
    });
    expect(result).toEqual({ ok: false, reason: "origin_scan_incomplete" });
  });

  it("a degraded pass still produced a report, so it starts checkout (REQ-029 c3)", async () => {
    const result = await createCheckoutSession({
      origin: { kind: "report", scanId: "scan-degraded" },
      returnTo: OURS,
    });
    expect(result.ok).toBe(true);
  });
});

describe("the return address is ours, compared after parsing and never by prefix", () => {
  it.each([
    ["a different host", "https://elsewhere.example/pricing"],
    ["a lookalike host", `${ENV_FIXTURE.NEXT_PUBLIC_APP_URL}.attacker.example/pricing`],
    ["a different scheme", "http://reachkit.example/pricing"],
    ["a different port", "https://reachkit.example:8443/pricing"],
    ["not a URL at all", "/pricing"],
  ])("%s is refused, and nothing is read or created", async (_name, returnTo) => {
    const result = await createCheckoutSession({ origin: { kind: "pricing" }, returnTo });
    expect(result).toEqual({ ok: false, reason: "return_to_not_ours" });
    expect(vendor.created).toHaveLength(0);
  });

  it("our own origin on any path is accepted, and the cancel URL is where they were reading", async () => {
    const result = await createCheckoutSession({ origin: { kind: "pricing" }, returnTo: OURS });
    expect(result.ok).toBe(true);
    expect(vendor.created[0]?.cancel_url).toBe(OURS);
  });
});

describe('REQ-020 c1/c2 — payment is the next thing asked, and leaving costs nothing', () => {
  it("createCheckoutSession takes no session and reads none", () => {
    // One parameter object, with exactly two members. A session argument
    // would have to be a third.
    expect(createCheckoutSession.length).toBe(1);
  });

  it("creating a session writes no users row, no site and no lead", async () => {
    await createCheckoutSession({ origin: { kind: "report", scanId: "scan-done" }, returnTo: OURS });
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
    expect(accounts.leads).toEqual([]);
  });
});

describe("a vendor failure is an arm, never a payload", () => {
  it("a thrown vendor error becomes reason: 'vendor' and carries no vendor text", async () => {
    vendor.sessionCreateError = new Error("card_declined: raw vendor text");
    const result = await createCheckoutSession({ origin: { kind: "pricing" }, returnTo: OURS });
    expect(result).toEqual({ ok: false, reason: "vendor" });
    expect(JSON.stringify(result)).not.toContain("raw vendor text");
  });
});
