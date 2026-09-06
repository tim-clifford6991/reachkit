// tests/account/checkout/params.test.ts — BUILD §13, issue #33
//
// What checkout asks, field by field, each field its own case — so that
// removing one guarantee fails one test and names it. The last case is the
// one that matters most: the object has *exactly* these keys, so a field
// added to checkout fails here until somebody says what it asks the buyer
// for.
import { describe, expect, it } from "vitest";
import { applyEnvFixture, ENV_FIXTURE } from "../../mail/env-fixture";

applyEnvFixture();

const { checkoutParams, CHECKOUT_PARAM_KEYS } = await import("@/lib/account/checkout/params");
const { PRICE_CURRENCY } = await import("@/lib/config/constants");

const params = checkoutParams();

describe('REQ-022 c2/c3 — "€49 is charged again, with no per-page, per-scan, per-competitor or any other usage-based amount added to it" and "there is exactly one" plan', () => {
  it("mode is subscription", () => {
    expect(params.mode).toBe("subscription");
  });

  it("exactly one line item, quantity 1 — no metered item, no second plan", () => {
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].quantity).toBe(1);
  });

  it("the line item is the configured price and nothing minted here", () => {
    expect(params.line_items[0].price).toBe(ENV_FIXTURE.STRIPE_PRICE_ID);
  });

  it("allow_promotion_codes is false — a promotion code is a second price", () => {
    expect(params.allow_promotion_codes).toBe(false);
  });
});

describe('REQ-022 c4 — "it is €49 in euro — the same amount and the same currency wherever they are, never converted to a local one — with no tax amount added to it or taken from it"', () => {
  it("currency is the pin, never a per-buyer choice", () => {
    expect(params.currency).toBe(PRICE_CURRENCY);
  });

  it("automatic_tax is disabled (DECISIONS 2026-08-28, ADR-052)", () => {
    expect(params.automatic_tax.enabled).toBe(false);
  });
});

describe('REQ-022 c5/c6 — the country is collected and the VAT field exists', () => {
  it("billing_address_collection is required", () => {
    expect(params.billing_address_collection).toBe("required");
  });

  it("tax_id_collection is enabled", () => {
    expect(params.tax_id_collection.enabled).toBe(true);
  });

  it("no country allow-list or block-list exists on this object", () => {
    // REQ-022 c5's second half: "no country they give refuses them the
    // purchase". A restriction would have to be a field here, and there is
    // no field here that is not asserted above.
    const source = JSON.stringify(params);
    expect(source).not.toMatch(/allowed_countries|blocked_countries|shipping_address_collection/);
  });
});

describe('REQ-020 c6 — "their company, their role, and what they mean to use the product for are asked nowhere before the payment completes"', () => {
  it("custom_fields is empty — the one place a questionnaire could be added", () => {
    expect(params.custom_fields).toEqual([]);
  });

  it("phone_number_collection is disabled", () => {
    expect(params.phone_number_collection.enabled).toBe(false);
  });

  it("customer_creation is always — the account is created by the payment", () => {
    expect(params.customer_creation).toBe("always");
  });

  it("the object has exactly the declared keys — an added field fails here", () => {
    expect(Object.keys(params).sort()).toEqual([...CHECKOUT_PARAM_KEYS].sort());
  });
});

describe("the object is frozen, and re-derived per call rather than shared", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(params)).toBe(true);
  });

  it("two calls are equal — one derivation, so both surfaces ask the same thing", () => {
    expect(checkoutParams()).toEqual(checkoutParams());
  });
});
