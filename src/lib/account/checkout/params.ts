// src/lib/account/checkout/params.ts — BUILD §13
//
// **What checkout asks, and nothing else.** The card details and the email
// (docs/SPEC.md §3 Checkout asks for card and email). The address is asked only
// where Stripe needs it; no tax ID, phone number or custom field is asked.
//
// The negative fields are written out so adding a question is a visible diff
// against an asserted object rather than an argument at a call site.
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
  /** Stripe asks for an address only where the payment method needs one. */
  readonly billing_address_collection: "auto";
  readonly tax_id_collection: { readonly enabled: false };
  /** DECISIONS 2026-08-28 · ADR-052. */
  readonly automatic_tax: { readonly enabled: false };
  // No `customer_creation`: Stripe accepts it in `payment` mode only and
  // refuses a subscription session that carries it. Subscription mode
  // creates the customer either way, which is what `record.ts` reads back.
  readonly phone_number_collection: { readonly enabled: false };
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
    billing_address_collection: "auto",
    tax_id_collection: Object.freeze({ enabled: false as const }),
    automatic_tax: Object.freeze({ enabled: false as const }),
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
  "phone_number_collection",
  "custom_fields",
  "allow_promotion_codes",
  "currency",
] as const);
