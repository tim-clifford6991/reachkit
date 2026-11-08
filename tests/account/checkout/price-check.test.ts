// tests/account/checkout/price-check.test.ts — BUILD §13
//
// ADR-052 point 3's check, now run by the production build (`scripts/check-price.mjs`), and the create-or-verify
// entry point that is the sanctioned way the Price object comes into existence. The build cases drive the script's
// own `report` over the real check against the vendor double, so what is asserted is the exit code a build obeys.
//
// The refusal in `createPrice` is the case worth having: creating a second Price is how a subscription base gets
// split — half the customers on one object, half on another, and no single thing to change when the amount changes.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { checkPriceForBuild } = await import("@/lib/account/checkout/build-check");
const { createPrice, verifyPrice } = await import("@/lib/account/checkout/ensure-price");
const { PRICE_OBJECT_SPEC } = await import("@/lib/account/checkout/price-object");
const { setStripe } = await import("@/lib/account/stripe/client");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");
const { report } = (await import("../../../scripts/check-price.mjs")) as {
  report: (result: { outcome: string; reason?: string; message?: string }) => number;
};

const SCRIPT = path.resolve(__dirname, "../../../scripts/check-price.mjs");

let vendor = newStripeDouble();
let out: string[] = [];

const matching = {
  unit_amount: PRICE_OBJECT_SPEC.unit_amount,
  currency: PRICE_OBJECT_SPEC.currency,
  recurring: { interval: PRICE_OBJECT_SPEC.recurring.interval },
  tax_behavior: PRICE_OBJECT_SPEC.tax_behavior,
};

beforeEach(() => {
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
  out = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => void out.push(String(line)));
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void out.push(String(line)));
});

afterEach(() => {
  vi.restoreAllMocks();
  setStripe(null);
});

/** What the build is told and whether it goes on: the exit code and every line it printed. */
async function build(): Promise<{ code: number; lines: string[] }> {
  const code = report(await checkPriceForBuild());
  return { code, lines: out };
}

describe("the production build refuses a crossed price", () => {
  it("a price that matches the spec lets the build go on, and says so in one line", async () => {
    vendor.price = { ...matching };
    expect(await build()).toEqual({ code: 0, lines: ['{"event":"price_check","outcome":"checked"}'] });
  });

  it.each([
    ["unit_amount", { unit_amount: 100 }],
    ["currency", { currency: "usd" }],
    ["recurring.interval", { recurring: { interval: "year" } }],
    ["tax_behavior", { tax_behavior: "exclusive" }],
  ] as const)("a price whose %s differs fails the build, naming the field", async (field, wrong) => {
    vendor.price = { ...matching, ...wrong };
    const { code, lines } = await build();
    expect(code).toBe(1);
    expect(JSON.parse(lines[0] ?? "")).toEqual({ event: "price_check", outcome: "refused", reason: "PriceObjectMismatch" });
    expect(lines[1]).toContain(field);
  });

  it("the mismatch says what was expected and what was found", async () => {
    vendor.price = { ...matching, unit_amount: 100 };
    const { lines } = await build();
    expect(lines[1]).toContain(String(PRICE_OBJECT_SPEC.unit_amount));
    expect(lines[1]).toContain("100");
  });

  it("a price the vendor says does not exist fails the build, naming the key's mode and never the key", async () => {
    vendor.price = null;
    const { code, lines } = await build();
    expect(code).toBe(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ outcome: "refused", reason: "PriceObjectUnknown" });
    expect(lines[1]).toMatch(/does not exist/);
    expect(lines.join("\n")).not.toContain("sk_fixture");
  });

  it("never prints the price id", async () => {
    vendor.price = { ...matching, currency: "usd" };
    expect((await build()).lines.join("\n")).not.toContain("price_fixture");
  });
});

describe("a vendor that could not be read establishes nothing, and the build goes on", () => {
  it("logs unchecked with the error's class, and no vendor payload", async () => {
    vendor.priceError = new Error("Invalid API Key provided: sk_live_verysecret");
    const { code, lines } = await build();
    expect(code).toBe(0);
    expect(lines).toEqual(['{"event":"price_check","outcome":"unchecked","reason":"Error"}']);
  });
});

describe("the script npm runs before `next build`", () => {
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, [SCRIPT], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", ...env },
      encoding: "utf8",
    });

  it("skips outside Vercel's build, where there is no deployment's price to check", () => {
    const result = run({});
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('{"event":"price_check","outcome":"skipped","reason":"not-vercel"}');
  });

  it("on Vercel it loads the check; bindings that do not parse are unchecked, and nothing secret is printed", () => {
    const result = run({ VERCEL: "1", STRIPE_SECRET_KEY: "sk_live_verysecret" });
    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe('{"event":"price_check","outcome":"unchecked","reason":"Error"}');
    expect(result.stdout + result.stderr).not.toContain("verysecret");
  }, 20_000);
});

describe("verify", () => {
  it("reports the configured price id when it matches", async () => {
    vendor.price = { ...matching };
    await expect(verifyPrice()).resolves.toEqual({
      ok: true,
      mode: "verified",
      priceId: "price_fixture",
    });
  });

  it("names the differing field rather than a vendor string", async () => {
    vendor.price = { ...matching, currency: "usd" };
    await expect(verifyPrice()).resolves.toEqual({ ok: false, reason: "mismatch", field: "currency" });
  });

  it("a vendor that cannot be read is its own arm", async () => {
    vendor.priceError = new Error("vendor is down");
    await expect(verifyPrice()).resolves.toEqual({ ok: false, reason: "vendor" });
  });
});

describe("create", () => {
  it("refuses when a verifying price is already configured — a second Price splits the base", async () => {
    vendor.price = { ...matching };
    await expect(createPrice("prod_one")).resolves.toEqual({
      ok: false,
      reason: "already_configured",
      priceId: "price_fixture",
    });
    expect(vendor.pricesCreated).toEqual([]);
  });

  it("creates from the spec, field for field, when there is nothing verifying", async () => {
    vendor.price = null;
    const result = await createPrice("prod_one");
    expect(result).toMatchObject({ ok: true, mode: "created" });
    expect(vendor.pricesCreated[0]).toEqual({
      product: "prod_one",
      currency: PRICE_OBJECT_SPEC.currency,
      unit_amount: PRICE_OBJECT_SPEC.unit_amount,
      recurring: { interval: PRICE_OBJECT_SPEC.recurring.interval },
      tax_behavior: PRICE_OBJECT_SPEC.tax_behavior,
    });
  });

  it("writes nothing to any table — the new id is returned for the owner to configure", async () => {
    vendor.price = null;
    const result = await createPrice("prod_one");
    expect(result.ok && "priceId" in result && result.priceId).toBeTruthy();
  });
});
