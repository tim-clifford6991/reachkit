// tests/account/provisioning/webhook.test.ts — BUILD §13, issue #33
//
// The trust boundary. Every case here is REQ-024 criterion 2 — "a claimed
// payment we cannot verify as ours … no account, no site and no sign-in
// email results" — approached from a different angle, because that is the
// criterion this file can break on its own.
//
// The provisioning call is a spy rather than the real thing: what is under
// test is whether the boundary lets a body through, not what happens after.
// Asserted by spy and not by absence of error, deliberately — a handler
// that ran and failed quietly looks identical to one that never ran.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { handleStripeWebhook, registerProvisionHandler, registerSubscriptionHandler } = await import(
  "@/lib/account/provisioning/webhook"
);
const { STRIPE_EVENTS } = await import("@/lib/account/provisioning/events");
const { setStripe } = await import("@/lib/account/stripe/client");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let accounts = newMemoryAccounts();
let vendor = newStripeDouble();
let provisioned: string[] = [];
let subscriptions: unknown[] = [];

function body(event: Record<string, unknown>): Buffer {
  return Buffer.from(JSON.stringify(event), "utf8");
}

const COMPLETED = {
  type: "checkout.session.completed",
  data: { object: { id: "cs_one" } },
};

beforeEach(() => {
  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));
  vendor = newStripeDouble();
  vendor.verifies = true;
  setStripe(stripeDouble(vendor));
  provisioned = [];
  subscriptions = [];
  registerProvisionHandler(async (sessionId) => void provisioned.push(sessionId));
  registerSubscriptionHandler(async (event) => void subscriptions.push(event));
});

afterEach(() => {
  registerProvisionHandler(null);
  registerSubscriptionHandler(null);
});

describe('REQ-024 c2 — a body that does not verify creates nothing and calls nothing', () => {
  it.each([
    ["a tampered body", "t_wrong_signature"],
    ["an empty signature", ""],
  ])("%s answers reason: 'signature'", async (_name, signature) => {
    vendor.verifies = signature === "good";
    const result = await handleStripeWebhook(body(COMPLETED), signature);
    expect(result).toEqual({ handled: false, reason: "signature" });
    expect(provisioned).toEqual([]);
    expect(subscriptions).toEqual([]);
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
  });

  it("a wrong secret answers the same way — the arms do not tell a prober which they got right", async () => {
    vendor.verifies = false;
    const result = await handleStripeWebhook(body(COMPLETED), "t_looks_plausible");
    expect(result).toEqual({ handled: false, reason: "signature" });
  });

  it("verification precedes parsing: the module holds no parse of its own, and the verifier gets the bytes", async () => {
    // The ordering is not observable through the two arms — a parse
    // failure and a signature failure are deliberately one answer — so it
    // is asserted the two ways it can be: this module contains no parse at
    // all, and the bytes the verifier receives are the bytes it was given.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    // Comments stripped: the module's own header *says* it calls no
    // `JSON.parse`, and a promise stated in prose must not fail the test
    // that checks the promise is kept.
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/account/provisioning/webhook.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/JSON\.parse/);
    expect(source).not.toMatch(/\.toString\(/);

    // A body carrying a multi-byte character, a CRLF and trailing space.
    // Any re-encoding on the way in changes these bytes, and a signature is
    // computed over bytes.
    const raw = Buffer.from('{"type":"checkout.session.completed","note":"\u00e9\r\n"} ', "utf8");
    let seen: Buffer | string | null = null;
    vendor.verifies = true;
    vendor.event = COMPLETED;
    const inner = stripeDouble(vendor);
    setStripe({
      ...inner,
      webhooks: {
        constructEvent: (b: Buffer | string, sig: string, secret: string) => {
          seen = b;
          return inner.webhooks.constructEvent(b, sig, secret);
        },
      },
    } as unknown as typeof inner);
    await handleStripeWebhook(raw, "t_good");
    expect(Buffer.isBuffer(seen)).toBe(true);
    expect(Buffer.compare(seen as unknown as Buffer, raw)).toBe(0);
  });

  it("an invalid signature over valid JSON never reaches the parse", async () => {
    vendor.verifies = false;
    const result = await handleStripeWebhook(body(COMPLETED), "t_bad");
    expect(result).toEqual({ handled: false, reason: "signature" });
    expect(provisioned).toEqual([]);
  });
});

describe("STRIPE_EVENTS is the closed list", () => {
  it("checkout.session.completed routes to provision, exactly once", async () => {
    const result = await handleStripeWebhook(body(COMPLETED), "t_good");
    expect(result).toEqual({
      handled: true,
      event: "checkout.session.completed",
      route: "provision",
    });
    expect(provisioned).toEqual(["cs_one"]);
  });

  it("a verified event type absent from the list answers unknown_event — never a throw, never a 500", async () => {
    vendor.event = { type: "radar.early_fraud_warning.created", data: { object: {} } };
    const result = await handleStripeWebhook(body({}), "t_good");
    expect(result).toEqual({ handled: false, reason: "unknown_event" });
    expect(provisioned).toEqual([]);
  });

  it("a subscription event routes to the subscription handler and provisions nothing", async () => {
    vendor.event = { type: "customer.subscription.updated", data: { object: {} } };
    const result = await handleStripeWebhook(body({}), "t_good");
    expect(result.handled).toBe(true);
    expect(subscriptions).toHaveLength(1);
    expect(provisioned).toEqual([]);
  });

  it("an ignored event is handled and acted on by nothing — distinct from absent", async () => {
    vendor.event = { type: "checkout.session.expired", data: { object: {} } };
    const result = await handleStripeWebhook(body({}), "t_good");
    expect(result).toEqual({ handled: true, event: "checkout.session.expired", route: "ignore" });
    expect(provisioned).toEqual([]);
    expect(subscriptions).toEqual([]);
    expect(accounts.users).toEqual([]);
  });

  it("exactly one row provisions, and it is the completed checkout session", () => {
    const provisionRows = Object.entries(STRIPE_EVENTS).filter(([, route]) => route === "provision");
    expect(provisionRows).toEqual([["checkout.session.completed", "provision"]]);
  });

  it("the map is frozen — a row cannot be added at runtime", () => {
    expect(Object.isFrozen(STRIPE_EVENTS)).toBe(true);
  });
});

describe("this module creates no table and writes no row of its own", () => {
  it("a verified provisioning event leaves the store untouched by the webhook itself", async () => {
    await handleStripeWebhook(body(COMPLETED), "t_good");
    // The spy stands in for provisioning, so anything written here would
    // have been written by the webhook.
    expect(accounts.users).toEqual([]);
    expect(accounts.sites).toEqual([]);
  });
});

describe("no log line carries the raw body, the signature or the secret", () => {
  it("emits the event type and the outcome, and nothing else", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (line: string) => void lines.push(String(line));
    try {
      await handleStripeWebhook(body(COMPLETED), "t_secret_signature");
    } finally {
      console.log = original;
    }
    const emitted = lines.join("\n");
    expect(emitted).not.toContain("t_secret_signature");
    expect(emitted).not.toContain("whsec_fixture");
    expect(emitted).not.toContain("cs_one");
    expect(emitted).toContain("checkout.session.completed");
  });
});

describe("redaction across the whole provisioning module", () => {
  it("no file names the webhook secret except through env", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(import.meta.dirname, "../../../src/lib/account/provisioning");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && statSync(path.join(dir, f)).isFile()
    );
    for (const file of files) {
      const source = readFileSync(path.join(dir, file), "utf8");
      // The one legal reference is `env.STRIPE_WEBHOOK_SECRET`.
      const bare = source.replace(/env\.STRIPE_WEBHOOK_SECRET/g, "");
      expect(bare, file).not.toContain("STRIPE_WEBHOOK_SECRET");
      expect(source, file).not.toMatch(/whsec_/);
    }
  });
});
