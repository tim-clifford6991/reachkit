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
// **The jobs bindings (issue #315).** `assertJobsBindings()` joins the same
// hook, beside the clock check: both ask whether this process is a real
// deployment and whether it is configured like one. The fixture's app URL is
// an https address that is not this machine, so every case in this file boots
// as a real deployment — which is what makes the refusal at the bottom the
// case worth having.
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
      // Issue #305's binding check is first: it is local, needs nobody, and
      // decides whether this process may serve a frozen date at all.
      { event: "boot_invariants", check: "clock", outcome: "checked" },
      // #315's bindings, decided in the same breath and before anything
      // registers or any vendor is asked.
      { event: "boot_invariants", check: "jobs", outcome: "checked" },
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
    // The clock binding, the jobs bindings, the gate and the place port are
    // local and were established before the vendor was asked.
    expect(logged.map((line) => JSON.parse(line))).toEqual([
      { event: "boot_invariants", check: "clock", outcome: "checked" },
      { event: "boot_invariants", check: "jobs", outcome: "checked" },
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

// ── the frozen clock a deployment may not carry (issue #305) ────────────

describe("a real deployment carrying RK_FIXED_NOW does not start", () => {
  const FIXED_NOW_BEFORE = process.env.RK_FIXED_NOW;

  afterEach(() => {
    if (FIXED_NOW_BEFORE === undefined) delete process.env.RK_FIXED_NOW;
    else process.env.RK_FIXED_NOW = FIXED_NOW_BEFORE;
  });

  it("throws out of register(), before the gate or the vendor is reached", async () => {
    // `applyEnvFixture` binds `NEXT_PUBLIC_APP_URL` to an https address that
    // is not this machine, so this process looks exactly like a deployment a
    // customer reaches — which is the case that must not boot. The date it
    // would serve is not the date, on every screen, silently.
    process.env.RK_FIXED_NOW = "2026-09-08T12:00:00.000Z";
    vendor.price = { ...MATCHING };
    await expect(register()).rejects.toThrow(/RK_FIXED_NOW is set on a real deployment/);
    // Nothing after the refusal ran: no line was logged, so the gate was not
    // registered and Stripe was not read.
    expect(logged).toEqual([]);
    expect(errored).toEqual([]);
    expect(sitesWithActiveAccess).toBeDefined();
  });

  it("comes up normally once the binding is gone", async () => {
    delete process.env.RK_FIXED_NOW;
    vendor.price = { ...MATCHING };
    await expect(register()).resolves.toBeUndefined();
    expect(logged.map((line) => JSON.parse(line))[0]).toEqual({
      event: "boot_invariants",
      check: "clock",
      outcome: "checked",
    });
  });
});

// ── the jobs bindings a deployment must carry (issue #315) ───────────────
//
// **This block stays last in the file.** Its cases drop the module registry
// so that `env` re-parses a `process.env` one binding short, and every
// module `register()` imports after that is a fresh instance — the doubles
// this file installs at the top (`setStripe`, the access gate) are bound to
// the old ones. Nothing may follow that expects them.

describe("a real deployment that cannot run a job does not start", () => {
  const SIGNING_BEFORE = process.env.INNGEST_SIGNING_KEY;
  const EVENT_BEFORE = process.env.INNGEST_EVENT_KEY;

  afterEach(() => {
    if (SIGNING_BEFORE === undefined) delete process.env.INNGEST_SIGNING_KEY;
    else process.env.INNGEST_SIGNING_KEY = SIGNING_BEFORE;
    if (EVENT_BEFORE === undefined) delete process.env.INNGEST_EVENT_KEY;
    else process.env.INNGEST_EVENT_KEY = EVENT_BEFORE;
    vi.resetModules();
  });

  it.each(["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"] as const)(
    "throws out of register() when %s is missing, before the gate or the vendor is reached",
    async (name) => {
      delete process.env[name];
      vendor.price = { ...MATCHING };
      vi.resetModules();
      const { register: freshRegister } = await import("@/instrumentation");
      await expect(freshRegister()).rejects.toThrow(new RegExp(name));
      // The clock check ran and logged; nothing after the refusal did.
      expect(logged.map((line) => JSON.parse(line))).toEqual([
        { event: "boot_invariants", check: "clock", outcome: "checked" },
      ]);
      expect(errored).toEqual([]);
    }
  );

  it("names no binding value in the refusal", async () => {
    delete process.env.INNGEST_SIGNING_KEY;
    vi.resetModules();
    const { register: freshRegister } = await import("@/instrumentation");
    const thrown = await freshRegister().catch((error: unknown) => error);
    expect(String(thrown)).not.toContain("event-key-fixture");
    expect([...logged, ...errored].join("\n")).not.toContain("event-key-fixture");
  });
});
