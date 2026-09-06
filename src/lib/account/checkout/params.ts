// src/lib/account/checkout/params.ts — BUILD §13
//
// **What checkout asks, and nothing else.** REQ-020 criterion 6: a founder
// at checkout is asked "only what taking the payment needs — their card
// details, the address the sign-in link and receipt go to, and the billing
// details REQ-022 criteria 5 and 6 record". Their company, their role and
// what they mean to use the product for are asked nowhere before the
// payment completes.
//
// That is why the four negative fields are written out. `custom_fields: []`
// and `phone_number_collection: { enabled: false }` are not defaults being
// restated: they are the two places a question could be added, stated as
// empty so adding one is a visible diff against an asserted object rather
// than an argument at a call site.
//
// `automatic_tax: { enabled: false }` is DECISIONS' 2026-08-28 ruling — no
// Stripe Tax at launch — and `allow_promotion_codes: false` is REQ-022
// criterion 3's "exactly one" plan: a promotion code is a second price.
//
// **Frozen, and asserted key by key.** `tests/account/checkout/params.test.ts`
// asserts the object has exactly these keys, so a field added here fails
// until somebody says what it asks the buyer for.
import { PRICE_CURRENCY } from "@/lib/config/constants";
import { env } from "@/lib/config/env";

export interface CheckoutParams {
  readonly mode: "subscription";
  readonly line_items: readonly [{ readonly price: string; readonly quantity: 1 }];
  /** REQ-022 c5 — the country is collected, and no country refuses the
   *  purchase: there is no allow-list and no block-list on any path. */
  readonly billing_address_collection: "required";
  /** REQ-022 c6 — the field exists. Nothing checks what is entered in it. */
  readonly tax_id_collection: { readonly enabled: true };
  /** DECISIONS 2026-08-28 · ADR-052. */
  readonly automatic_tax: { readonly enabled: false };
  readonly customer_creation: "always";
  /** REQ-020 c6 — nothing beyond the payment is asked. */
  readonly phone_number_collection: { readonly enabled: false };
  /** REQ-020 c6 — the one place a questionnaire could be added, empty. */
  readonly custom_fields: readonly [];
  /** REQ-022 c3 — one plan, so no code that makes a second one. */
  readonly allow_promotion_codes: false;
  /** REQ-022 c4 — the same currency wherever the buyer is. */
  readonly currency: typeof PRICE_CURRENCY;
}

/** Built once per call rather than at module load: `env.STRIPE_PRICE_ID` is
 *  read when checkout runs, not when a file that type-imports this module
 *  is loaded. */
export function checkoutParams(): CheckoutParams {
  return Object.freeze({
    mode: "subscription",
    line_items: Object.freeze([
      Object.freeze({ price: env.STRIPE_PRICE_ID, quantity: 1 as const }),
    ] as const),
    billing_address_collection: "required",
    tax_id_collection: Object.freeze({ enabled: true as const }),
    automatic_tax: Object.freeze({ enabled: false as const }),
    customer_creation: "always",
    phone_number_collection: Object.freeze({ enabled: false as const }),
    custom_fields: Object.freeze([] as const),
    allow_promotion_codes: false,
    currency: PRICE_CURRENCY,
  } as const);
}

/** The key set, named once, so "exactly these and no more" is one list the
 *  test reads rather than a list the test repeats. */
export const CHECKOUT_PARAM_KEYS: readonly (keyof CheckoutParams)[] = Object.freeze([
  "mode",
  "line_items",
  "billing_address_collection",
  "tax_id_collection",
  "automatic_tax",
  "customer_creation",
  "phone_number_collection",
  "custom_fields",
  "allow_promotion_codes",
  "currency",
] as const);
