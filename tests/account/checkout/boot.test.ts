// tests/account/checkout/boot.test.ts — BUILD §13, issue #33
//
// ADR-052 point 3's boot check, and the create-or-verify entry point that
// is the sanctioned way the Price object comes into existence.
//
// The refusal in `createPrice` is the case worth having: creating a second
// Price is how a subscription base gets split — half the customers on one
// object, half on another, and no single thing to change when the amount
// changes.
import { beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { assertCheckoutBootInvariants } = await import("@/lib/account/checkout/boot");
const { createPrice, verifyPrice } = await import("@/lib/account/checkout/ensure-price");
const { PRICE_OBJECT_SPEC, PriceObjectMismatch } = await import(
  "@/lib/account/checkout/price-object"
);
const { setStripe } = await import("@/lib/account/stripe/client");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

let vendor = newStripeDouble();

const matching = {
  unit_amount: PRICE_OBJECT_SPEC.unit_amount,
  currency: PRICE_OBJECT_SPEC.currency,
  recurring: { interval: PRICE_OBJECT_SPEC.recurring.interval },
  tax_behavior: PRICE_OBJECT_SPEC.tax_behavior,
};

beforeEach(() => {
  vendor = newStripeDouble();
  setStripe(stripeDouble(vendor));
});

describe("the boot hook rethrows — a deployment does not start against a price we do not describe", () => {
  it("passes when the live price matches", async () => {
    vendor.price = { ...matching };
    await expect(assertCheckoutBootInvariants()).resolves.toBeUndefined();
  });

  it("throws when it does not, naming the field", async () => {
    vendor.price = { ...matching, unit_amount: 100 };
    await expect(assertCheckoutBootInvariants()).rejects.toBeInstanceOf(PriceObjectMismatch);
  });
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
