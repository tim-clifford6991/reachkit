// tests/account/checkout/record.test.ts — BUILD §13, issue #33
//
// The two facts a completed session collected, recorded exactly as they
// arrived. Most of this suite is about what the code does *not* do to them:
// REQ-022 criteria 5, 6 and 7 are all promises that the value a buyer gave
// survives unchanged, and every one of them is broken by a normalisation
// somebody adds to be helpful.
import { beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { recordCheckoutFacts } = await import("@/lib/account/checkout/record");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();

/** A completed session, with the pieces each case perturbs. */
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
  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
  vendor.sessions.set("cs_one", completedSession());
});

describe('REQ-022 c5 — "the country of the billing address they gave at checkout is recorded against their billing record"', () => {
  it("the country is what the vendor reported", async () => {
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.billingCountry).toBe("IE");
  });

  it("a lowercase country stays lowercase — never re-cased, never mapped", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({
        customer_details: { email: "founder@acme.example", address: { country: "ie" }, tax_ids: [] },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.billingCountry).toBe("ie");
  });

  it("a session with no country recorded lands as null, not a guess", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({ customer_details: { email: "founder@acme.example", tax_ids: [] } })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.billingCountry).toBeNull();
  });
});

describe('REQ-022 c6/c7 — the VAT number is recorded verbatim and validated by nothing', () => {
  it("round-trips byte-identical, spaces and mixed case included", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({
        customer_details: {
          email: "founder@acme.example",
          address: { country: "IE" },
          tax_ids: [{ type: "eu_vat", value: " ie 1234 567 Xy " }],
        },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    // Not trimmed, not uppercased, not stripped of spaces.
    expect(result.ok && result.facts.vatNumber).toBe(" ie 1234 567 Xy ");
  });

  it("an obviously invalid number is recorded unchanged and the call succeeds", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({
        customer_details: {
          email: "founder@acme.example",
          address: { country: "IE" },
          tax_ids: [{ type: "eu_vat", value: "not a vat number" }],
        },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok).toBe(true);
    expect(result.ok && result.facts.vatNumber).toBe("not a vat number");
  });

  it("an empty field records null, not the empty string — asked and left blank is not 'given as nothing'", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({
        customer_details: {
          email: "founder@acme.example",
          address: { country: "IE" },
          tax_ids: [{ type: "eu_vat", value: "" }],
        },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.vatNumber).toBeNull();
  });

  it("no tax id at all records null", async () => {
    vendor.sessions.set(
      "cs_one",
      completedSession({
        customer_details: { email: "founder@acme.example", address: { country: "IE" } },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.vatNumber).toBeNull();
  });
});

describe("the origin is read back from metadata and from nowhere else", () => {
  it("a report session resolves to that scan id", async () => {
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.origin).toEqual({ kind: "report", scanId: "scan-done" });
  });

  it("a session with no scanId in metadata is a scanless purchase, whatever the payer's email domain says", async () => {
    // The discriminating case for REQ-021 c7: a company email and a
    // billing country are both present and neither becomes a domain.
    vendor.sessions.set(
      "cs_one",
      completedSession({
        metadata: { originKind: "pricing" },
        customer_details: {
          email: "founder@acme.example",
          address: { country: "IE" },
          tax_ids: [],
        },
      })
    );
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.origin).toEqual({ kind: "pricing" });
  });

  it("an empty scanId in metadata is scanless — not a report with an empty id", async () => {
    vendor.sessions.set("cs_one", completedSession({ metadata: { originKind: "report", scanId: "" } }));
    const result = await recordCheckoutFacts("cs_one");
    expect(result.ok && result.facts.origin).toEqual({ kind: "pricing" });
  });
});

describe('REQ-024 c2 — "a claimed payment we cannot verify as ours … no account, no site and no sign-in email results"', () => {
  it("a session that did not complete records nothing and says so", async () => {
    vendor.sessions.set("cs_one", completedSession({ status: "open" }));
    const result = await recordCheckoutFacts("cs_one");
    expect(result).toEqual({ ok: false, reason: "session_not_complete" });
    expect(accounts.users).toEqual([]);
  });

  it("a vendor failure is an arm and carries no vendor text", async () => {
    vendor.sessionRetrieveError = new Error("raw vendor text");
    const result = await recordCheckoutFacts("cs_one");
    expect(result).toEqual({ ok: false, reason: "vendor" });
    expect(JSON.stringify(result)).not.toContain("raw vendor text");
  });
});

describe("idempotent on the session id", () => {
  it("a second call returns the same values", async () => {
    const first = await recordCheckoutFacts("cs_one");
    const second = await recordCheckoutFacts("cs_one");
    expect(second).toEqual(first);
  });

  it("with an account already open, it writes the three columns and no other", async () => {
    const store = memoryAccountStore(accounts);
    setAccountStore(store);
    await store.insertAccount({
      email: "founder@acme.example",
      checkoutSessionId: "cs_one",
      facts: { stripe_customer_id: "cus_stale", billing_country: null, vat_number: null },
    });
    const before = { ...accounts.users[0] };
    await recordCheckoutFacts("cs_one");
    const after = accounts.users[0];
    expect(after?.stripe_customer_id).toBe("cus_one");
    expect(after?.billing_country).toBe("IE");
    expect(after?.vat_number).toBe("IE1234567X");
    // Everything else is untouched.
    expect(after?.id).toBe(before.id);
    expect(after?.email).toBe(before.email);
    expect(after?.checkout_session_id).toBe(before.checkout_session_id);
    expect(after?.first_signed_in_at).toBe(before.first_signed_in_at);
    expect(after?.sign_in_chased_at).toBe(before.sign_in_chased_at);
    expect(after?.created_at).toBe(before.created_at);
  });

  it("with no account yet, it writes nothing at all — the insert carries the facts", async () => {
    await recordCheckoutFacts("cs_one");
    expect(accounts.users).toEqual([]);
  });
});

describe("nothing this module logs can carry an address or a VAT number", () => {
  it("the emitted event has exactly three fields, none of which can hold one", async () => {
    const { checkoutEvent } = await import("@/lib/account/checkout/redaction");
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => void lines.push(line);
    try {
      checkoutEvent({ sessionId: "cs_one", originKind: "report", outcome: "recorded" });
    } finally {
      console.log = original;
    }
    expect(Object.keys(JSON.parse(lines[0] ?? "{}")).sort()).toEqual([
      "event",
      "originKind",
      "outcome",
      "sessionId",
    ]);
  });

  it("no line this module emits contains the address, the country or the VAT number", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => void lines.push(String(line));
    try {
      await recordCheckoutFacts("cs_one");
    } finally {
      console.log = original;
    }
    const emitted = lines.join("\n");
    expect(emitted).not.toContain("founder@acme.example");
    expect(emitted).not.toContain("IE1234567X");
  });
});
