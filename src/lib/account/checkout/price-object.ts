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

/** Which mode the configured secret key belongs to, read off its prefix.
 *  Stripe's secret and restricted keys both carry it (`sk_live_…`,
 *  `rk_test_…`); a key wearing neither is `unrecognised` rather than
 *  guessed at. */
export type KeyMode = "live" | "test" | "unrecognised";

export function keyModeOf(secretKey: string): KeyMode {
  if (/^[a-z]+_live_/.test(secretKey)) return "live";
  if (/^[a-z]+_test_/.test(secretKey)) return "test";
  return "unrecognised";
}

/** Thrown when Stripe answered, and its answer was that the price behind
 *  `STRIPE_PRICE_ID` does not exist under this secret key.
 *
 *  **This is the test-mode/live-mode crossing, and it is not an outage**
 *  (issue 889). A test-mode price id and a live-mode secret key each look
 *  perfectly well-formed on their own — `price_…` carries no mode and the
 *  key is never printed — so the only place the crossing is visible is the
 *  vendor's `resource_missing`. Reported as a vendor read that did not
 *  happen, it left the deployment serving a `/pricing` page whose Start
 *  button fails for every visitor, with one log line naming an error class.
 *  It is a fact about this deployment's own configuration, established by
 *  an answer the vendor gave, so it refuses the boot exactly as a mismatch
 *  does.
 *
 *  The message names the mode of the configured key — which is derived from
 *  the key's own prefix and is not the key — so the reader is told the one
 *  thing that distinguishes this from a typo. */
export class PriceObjectUnknown extends Error {
  /** `"live"`, `"test"`, or `"unrecognised"` where the key wears neither
   *  prefix. Never the key. */
  readonly keyMode: KeyMode;
  constructor(keyMode: KeyMode) {
    super(
      "src/lib/account/checkout/price-object.ts: Stripe answered that the price behind " +
        "STRIPE_PRICE_ID does not exist. " +
        (keyMode === "unrecognised"
          ? "The configured STRIPE_SECRET_KEY wears neither a live- nor a test-mode prefix, so which mode it reads cannot be stated here. "
          : `The configured STRIPE_SECRET_KEY is a ${keyMode}-mode key, and a price created in the other mode is not reachable with it — test-mode and live-mode objects are separate. `) +
        "Bind a price created in that key's mode, or repoint STRIPE_SECRET_KEY. " +
        "Checkout is not started against a price that does not exist."
    );
    this.name = "PriceObjectUnknown";
    this.keyMode = keyMode;
  }
}

/** Whether the vendor's own answer was "there is no such object". Read off
 *  the error's `code` rather than through `instanceof`: the SDK is
 *  constructed lazily behind `stripe()` and its error classes would have to
 *  be imported at module load to be compared against, while `code` is the
 *  stable, documented handle and is what a double can honestly wear. */
function isResourceMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === "resource_missing";
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
  let price: unknown;
  try {
    price = await stripe().prices.retrieve(env.STRIPE_PRICE_ID);
  } catch (error) {
    // Two failures wear one shape at the call site and must not: a vendor
    // this deployment could not reach has established nothing, while a
    // vendor that answered `resource_missing` has established that the
    // configured price is not in the configured key's mode. Only the second
    // is this deployment's own configuration, and only the second refuses
    // the boot.
    if (isResourceMissing(error)) throw new PriceObjectUnknown(keyModeOf(env.STRIPE_SECRET_KEY));
    throw error;
  }
  assertPriceMatchesSpec(price as unknown as LivePrice);
}
