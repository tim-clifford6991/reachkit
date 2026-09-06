// src/lib/account/checkout/ensure-price.ts — BUILD §13
//
// The sanctioned way the Price object comes into existence: create it from
// `PRICE_OBJECT_SPEC`, or verify the one that is already there.
//
// ADR-052's problem is that the Price lives in a vendor dashboard, where
// somebody can type an amount. This entry point is the answer — a price
// created from the checked-in spec is a price the boot assertion already
// agrees with, and a price created by hand is one this function will refuse
// to shadow with a second.
//
// **`create` refuses when a verifying price is already configured.**
// Creating a second Price is how a subscription base gets split: half the
// customers on one object, half on another, and no single thing to change
// when the amount changes. The refusal is the point of the mode.
//
// It writes nothing to any table. The new price's id is returned for the
// owner to put in `STRIPE_PRICE_ID`; this repository does not hold vendor
// object ids.
import { env } from "@/lib/config/env";
import { stripe } from "../stripe/client";
import { assertLivePriceMatchesSpec, PRICE_OBJECT_SPEC, PriceObjectMismatch } from "./price-object";

export type EnsurePriceResult =
  | { ok: true; mode: "verified"; priceId: string }
  | { ok: true; mode: "created"; priceId: string }
  | { ok: false; reason: "mismatch"; field: string }
  | { ok: false; reason: "already_configured"; priceId: string }
  | { ok: false; reason: "vendor" };

/** Verifies the configured Price against the spec. */
export async function verifyPrice(): Promise<EnsurePriceResult> {
  try {
    await assertLivePriceMatchesSpec();
    return { ok: true, mode: "verified", priceId: env.STRIPE_PRICE_ID };
  } catch (error) {
    if (error instanceof PriceObjectMismatch) {
      return { ok: false, reason: "mismatch", field: error.field };
    }
    return { ok: false, reason: "vendor" };
  }
}

/** Creates the Price from the spec against `productId`, unless the
 *  configured one already verifies. */
export async function createPrice(productId: string): Promise<EnsurePriceResult> {
  const existing = await verifyPrice();
  if (existing.ok) return { ok: false, reason: "already_configured", priceId: existing.priceId };

  try {
    const price = await stripe().prices.create({
      product: productId,
      currency: PRICE_OBJECT_SPEC.currency,
      unit_amount: PRICE_OBJECT_SPEC.unit_amount,
      recurring: { interval: PRICE_OBJECT_SPEC.recurring.interval },
      tax_behavior: PRICE_OBJECT_SPEC.tax_behavior,
    });
    return { ok: true, mode: "created", priceId: price.id };
  } catch {
    return { ok: false, reason: "vendor" };
  }
}
