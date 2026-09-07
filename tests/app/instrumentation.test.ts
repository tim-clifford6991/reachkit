// tests/app/instrumentation.test.ts — BUILD §15, issue #124
//
// The boot path, driven end to end: `register()` is what Next calls once
// per server instance, and these run the real assertion behind it against
// the vendor double rather than a mock of the assertion — a mocked boot
// hook would prove the wiring and nothing about the invariant.
//
// The claim worth having is the second one. A Price object whose amount
// somebody typed in a dashboard is the failure ADR-052 exists for, and the
// only place it can be caught is a boot that refuses to come up.
//
// **Two invariants now (issue #180).** ADR-050's access gate is registered
// here too, and asserted through the seam the weekly selection reads — so
// these cases also hold that the gate is installed on *every* Node boot,
// including the ones where Stripe could not be read and the checkout arm
// returns early.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { register } = await import("@/instrumentation");
const { PRICE_OBJECT_SPEC, PriceObjectMismatch } = await import(
  "@/lib/account/checkout/price-object"
);
const { setStripe } = await import("@/lib/account/stripe/client");
const { registerActiveAccessGate, sitesWithActiveAccess } = await import(
  "@/lib/scan/weekly/access"
);
const { newStripeDouble, stripeDouble } = await import("../account/stripe-double");

const MATCHING = {
  unit_amount: PRICE_OBJECT_SPEC.unit_amount,
  currency: PRICE_OBJECT_SPEC.currency,
  recurring: { interval: PRICE_OBJECT_SPEC.recurring.interval },
  tax_behavior: PRICE_OBJECT_SPEC.tax_behavior,
};

let vendor = newStripeDouble();
let logged: string[] = [];
let errored: string[] = [];
const runtimeBefore = process.env.NEXT_RUNTIME;

/** The one line a case expects, parsed. Fails loudly rather than reading
 *  `[0]` off an array the run may not have filled. */
function onlyLine(lines: readonly string[]): Record<string, unknown> {
  expect(lines).toHaveLength(1);
  return JSON.parse(lines[0] ?? "") as Record<string, unknown>;
}

beforeEach(() => {
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
  logged = [];
  errored = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => void logged.push(String(line)));
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void errored.push(String(line)));
  process.env.NEXT_RUNTIME = "nodejs";
  // Unregistered before each case, so what is asserted below is this boot
  // registering it and never a leftover from another suite.
  registerActiveAccessGate(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  setStripe(null);
  registerActiveAccessGate(null);
  if (runtimeBefore === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = runtimeBefore;
});

describe("the assertion runs once at boot, on the Node.js runtime", () => {
  it("a price that matches the spec lets the server come up, and says so in one line", async () => {
    vendor.price = { ...MATCHING };
    await expect(register()).resolves.toBeUndefined();
    expect(logged.map((line) => JSON.parse(line))).toEqual([
      { event: "boot_invariants", check: "access-gate", outcome: "checked" },
      { event: "boot_invariants", check: "stamp-place", outcome: "checked" },
      { event: "boot_invariants", check: "checkout", outcome: "checked" },
    ]);
    expect(errored).toEqual([]);
  });

  it("the edge runtime does nothing at all — the assertion reads server-only bindings", async () => {
    // Next calls `register` in every runtime. A mismatching price here would
    // fail the boot on Node.js; on edge nothing reads it.
    process.env.NEXT_RUNTIME = "edge";
    vendor.price = { ...MATCHING, unit_amount: 100 };
    await expect(register()).resolves.toBeUndefined();
    expect(logged).toEqual([]);
    expect(errored).toEqual([]);
  });
});

describe("a wrong Price object fails the boot, and the mismatch is named", () => {
  it.each([
    ["unit_amount", { unit_amount: 100 }],
    ["currency", { currency: "usd" }],
    ["recurring.interval", { recurring: { interval: "year" } }],
    ["tax_behavior", { tax_behavior: "exclusive" }],
  ] as const)("a price whose %s differs stops the boot", async (field, wrong) => {
    vendor.price = { ...MATCHING, ...wrong };
    const thrown = await register().then(
      () => null,
      (error: unknown) => error
    );
    expect(thrown).toBeInstanceOf(PriceObjectMismatch);
    expect((thrown as InstanceType<typeof PriceObjectMismatch>).field).toBe(field);
  });

  it("the error names the field, what was expected and what was found", async () => {
    vendor.price = { ...MATCHING, unit_amount: 100 };
    const thrown = await register().catch((error: unknown) => error);
    const message = String(thrown);
    expect(message).toContain("unit_amount");
    expect(message).toContain(String(PRICE_OBJECT_SPEC.unit_amount));
    expect(message).toContain("100");
  });

  it("it never names the price id — a boot log is not where a vendor object id belongs", async () => {
    vendor.price = { ...MATCHING, currency: "usd" };
    const thrown = await register().catch((error: unknown) => error);
    expect(String(thrown)).not.toContain("price_fixture");
    expect([...logged, ...errored].join("\n")).not.toContain("price_fixture");
  });
});

describe("a vendor that could not be read is not a mismatch, and does not take the deployment down", () => {
  it("the boot completes and says the check did not run", async () => {
    vendor.priceError = new Error("vendor is down");
    await expect(register()).resolves.toBeUndefined();
    expect(errored.map((line) => JSON.parse(line))).toEqual([
      { event: "boot_invariants", check: "checkout", outcome: "unchecked", reason: "Error" },
    ]);
    // The gate and the place port are local and were established before
    // the vendor was asked.
    expect(logged.map((line) => JSON.parse(line))).toEqual([
      { event: "boot_invariants", check: "access-gate", outcome: "checked" },
      { event: "boot_invariants", check: "stamp-place", outcome: "checked" },
    ]);
  });

  it("a price that is not there at all is the same arm — a read that did not happen asserts nothing", async () => {
    vendor.price = null;
    await expect(register()).resolves.toBeUndefined();
    expect(onlyLine(errored)).toMatchObject({ outcome: "unchecked" });
  });

  it("the access gate is registered on that boot too — an unreadable price is not a reason to guess who pays", async () => {
    vendor.priceError = new Error("vendor is down");
    await register();
    await expect(sitesWithActiveAccess("test", [])).resolves.toEqual(new Set());
  });

  it("the line carries no binding value and no vendor payload", async () => {
    vendor.priceError = new Error("Invalid API Key provided: sk_live_verysecret");
    await expect(register()).resolves.toBeUndefined();
    const line = errored.join("\n");
    expect(line).not.toContain("sk_");
    expect(line).not.toContain("vendor is down");
    expect(Object.keys(onlyLine(errored)).sort()).toEqual([
      "check",
      "event",
      "outcome",
      "reason",
    ]);
  });
});
