// src/lib/account/checkout/price-object.ts — BUILD §13
//
// **The Price object lives in Stripe, outside this repository.** ADR-052
// states it plainly, and that is the whole reason this file exists: the
// object a customer is charged against is created in a vendor dashboard,
// where no test can reach it and no diff can show it changing. So the spec
// is checked in here, built from the three pins, and one assertion compares
// the live object against it.
//
// **`tax_behavior: 'inclusive'` is the one literal this repository states
// about the Price object.** DECISIONS, 2026-08-31: "The €49 Stripe Price is
// tax-inclusive with Stripe Tax off; switching tax on must never raise a
// customer's bill." An exclusive price with tax switched on later adds VAT
// *on top* of the amount every existing customer agreed to. Inclusive means
// the day registration is set up, the bill stays where it was and the tax
// comes out of it. That is not a preference; it is the difference between a
// silent price rise and none.
import {
  PRICE_CURRENCY,
  PRICE_EUR_CENTS,
  PRICE_INTERVAL,
} from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { stripe } from "../stripe/client";

/** What the Price object behind `STRIPE_PRICE_ID` must be. Frozen, and
 *  built from the pins rather than from four literals — a price that
 *  disagrees with `PRICE_EUR_CENTS` cannot be written here without
 *  changing the pin the offer surface reads. */
export const PRICE_OBJECT_SPEC = Object.freeze({
  currency: PRICE_CURRENCY,
  unit_amount: PRICE_EUR_CENTS,
  recurring: Object.freeze({ interval: PRICE_INTERVAL }),
  tax_behavior: "inclusive",
} as const);

/** The four fields compared, named once so the error can say which one
 *  differed and the test can enumerate them. */
export type PriceField = "unit_amount" | "currency" | "recurring.interval" | "tax_behavior";

export const PRICE_FIELDS: readonly PriceField[] = Object.freeze([
  "unit_amount",
  "currency",
  "recurring.interval",
  "tax_behavior",
] as const);

/** Thrown when the live Price differs from the spec. Names the field, the
 *  expected value and what was found — never the price id, which is not a
 *  secret but is not a fact a log needs either. */
export class PriceObjectMismatch extends Error {
  readonly field: PriceField;
  constructor(field: PriceField, expected: unknown, found: unknown) {
    super(
      `src/lib/account/checkout/price-object.ts: the live Stripe Price differs from ` +
        `PRICE_OBJECT_SPEC at ${field} — expected ${JSON.stringify(expected)}, found ${JSON.stringify(found)}. ` +
        "Checkout is not started against a price this repository does not describe."
    );
    this.name = "PriceObjectMismatch";
    this.field = field;
  }
}

/** What the comparison reads off a live Price. Narrower than the SDK's own
 *  type on purpose: nothing else about the object is this repository's
 *  business, and a field not read here cannot be accidentally asserted. */
export interface LivePrice {
  readonly unit_amount: number | null;
  readonly currency: string;
  readonly recurring: { readonly interval: string } | null;
  readonly tax_behavior?: string | null;
}

/** Compares a live Price against the spec, field by field, in
 *  `PRICE_FIELDS` order. Throws on the first difference. Separated from the
 *  vendor read so the four difference cases are testable without a vendor
 *  double at all. */
export function assertPriceMatchesSpec(price: LivePrice): void {
  if (price.unit_amount !== PRICE_OBJECT_SPEC.unit_amount) {
    throw new PriceObjectMismatch("unit_amount", PRICE_OBJECT_SPEC.unit_amount, price.unit_amount);
  }
  if (price.currency !== PRICE_OBJECT_SPEC.currency) {
    throw new PriceObjectMismatch("currency", PRICE_OBJECT_SPEC.currency, price.currency);
  }
  const interval = price.recurring?.interval ?? null;
  if (interval !== PRICE_OBJECT_SPEC.recurring.interval) {
    throw new PriceObjectMismatch("recurring.interval", PRICE_OBJECT_SPEC.recurring.interval, interval);
  }
  if (price.tax_behavior !== PRICE_OBJECT_SPEC.tax_behavior) {
    throw new PriceObjectMismatch("tax_behavior", PRICE_OBJECT_SPEC.tax_behavior, price.tax_behavior ?? null);
  }
}

/** Reads the Price behind `STRIPE_PRICE_ID` and compares it against the
 *  spec. The one function that reaches the vendor here. */
export async function assertLivePriceMatchesSpec(): Promise<void> {
  const price = await stripe().prices.retrieve(env.STRIPE_PRICE_ID);
  assertPriceMatchesSpec(price as unknown as LivePrice);
}
