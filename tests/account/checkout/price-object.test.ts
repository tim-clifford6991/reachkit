// tests/account/checkout/price-object.test.ts — BUILD §13, issue #33
//
// ADR-052's whole problem is that the Price object lives in a vendor
// dashboard where nothing in this repository can see it change. The spec
// and the four comparisons are the answer, so this suite asserts the spec
// against the pins and then breaks each of the four fields in turn — four
// separate cases, so that deleting one comparison fails exactly one of them
// and no other.
import { beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { PRICE_CURRENCY, PRICE_EUR_CENTS, PRICE_INTERVAL } = await import(
  "@/lib/config/constants"
);
const { PRICE_OBJECT_SPEC, PRICE_FIELDS, PriceObjectMismatch, assertPriceMatchesSpec } =
  await import("@/lib/account/checkout/price-object");
const { setStripe } = await import("@/lib/account/stripe/client");
const { assertLivePriceMatchesSpec } = await import("@/lib/account/checkout/price-object");
const { newStripeDouble, stripeDouble } = await import("../stripe-double");

/** A live Price that matches the spec exactly — the base every difference
 *  case perturbs by exactly one field. */
function matchingPrice() {
  return {
    unit_amount: PRICE_EUR_CENTS,
    currency: PRICE_CURRENCY,
    recurring: { interval: PRICE_INTERVAL },
    tax_behavior: "inclusive",
  };
}

beforeEach(() => setStripe(null));

describe("the spec is built from the pins, never from four literals", () => {
  it("unit_amount, currency and recurring.interval equal the pins", () => {
    expect(PRICE_OBJECT_SPEC.unit_amount).toBe(PRICE_EUR_CENTS);
    expect(PRICE_OBJECT_SPEC.currency).toBe(PRICE_CURRENCY);
    expect(PRICE_OBJECT_SPEC.recurring.interval).toBe(PRICE_INTERVAL);
  });

  it("is frozen, recurring included — a spec a caller could edit is not a spec", () => {
    expect(Object.isFrozen(PRICE_OBJECT_SPEC)).toBe(true);
    expect(Object.isFrozen(PRICE_OBJECT_SPEC.recurring)).toBe(true);
  });
});

describe('DECISIONS 2026-08-31 (ADR-052): "The €49 Stripe Price is tax-inclusive with Stripe Tax off; switching tax on must never raise a customer\'s bill."', () => {
  it("tax_behavior is 'inclusive' — the one literal this repository states about the Price object", () => {
    expect(PRICE_OBJECT_SPEC.tax_behavior).toBe("inclusive");
  });

  it("a live price reporting 'exclusive' fails the assertion, naming that field", () => {
    // The discriminating case for the ruling: an exclusive price with tax
    // switched on later adds VAT on top of what every existing customer
    // agreed to, which is the bill rise the ruling forbids.
    expect(() => assertPriceMatchesSpec({ ...matchingPrice(), tax_behavior: "exclusive" })).toThrow(
      PriceObjectMismatch
    );
    try {
      assertPriceMatchesSpec({ ...matchingPrice(), tax_behavior: "exclusive" });
      expect.unreachable();
    } catch (error) {
      expect((error as InstanceType<typeof PriceObjectMismatch>).field).toBe("tax_behavior");
    }
  });
});

describe("each of the four fields is compared, and each difference is its own failure", () => {
  it("a matching price passes", () => {
    expect(() => assertPriceMatchesSpec(matchingPrice())).not.toThrow();
  });

  const cases: [string, Record<string, unknown>][] = [
    ["unit_amount", { unit_amount: PRICE_EUR_CENTS + 1 }],
    ["currency", { currency: "usd" }],
    ["recurring.interval", { recurring: { interval: "year" } }],
    ["tax_behavior", { tax_behavior: "exclusive" }],
  ];

  it.each(cases)("a price differing at %s fails at exactly that field", (field, patch) => {
    try {
      assertPriceMatchesSpec({ ...matchingPrice(), ...patch });
      expect.unreachable();
    } catch (error) {
      expect((error as InstanceType<typeof PriceObjectMismatch>).field).toBe(field);
    }
  });

  it("a price with no recurring block at all fails at recurring.interval, never silently", () => {
    try {
      assertPriceMatchesSpec({ ...matchingPrice(), recurring: null });
      expect.unreachable();
    } catch (error) {
      expect((error as InstanceType<typeof PriceObjectMismatch>).field).toBe("recurring.interval");
    }
  });

  it("PRICE_FIELDS names every field the comparison makes and no other", () => {
    expect([...PRICE_FIELDS]).toEqual([
      "unit_amount",
      "currency",
      "recurring.interval",
      "tax_behavior",
    ]);
  });
});

describe("the live read", () => {
  it("reads the price behind STRIPE_PRICE_ID and passes when it matches", async () => {
    const state = newStripeDouble();
    state.price = matchingPrice();
    setStripe(stripeDouble(state));
    await expect(assertLivePriceMatchesSpec()).resolves.toBeUndefined();
  });

  it("a live price the vendor reports as exclusive fails the boot assertion", async () => {
    const state = newStripeDouble();
    state.price = { ...matchingPrice(), tax_behavior: "exclusive" };
    setStripe(stripeDouble(state));
    await expect(assertLivePriceMatchesSpec()).rejects.toBeInstanceOf(PriceObjectMismatch);
  });
});
