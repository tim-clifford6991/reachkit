// src/lib/account/stripe/client.ts — BUILD §13, §15
//
// The one file that names the payment vendor's SDK. Every Stripe call this
// module makes goes through `stripe()`, so swapping the vendor is this file
// and the four call sites' argument shapes, not a search for `new Stripe`.
//
// **Not `safeFetch()`, and not the cost seam.** BP-006's guard exists for
// URLs a *customer* or a dataset supplied — it resolves the host, checks it
// against a policy and refuses private space, and it is a GET-only reader
// besides. The Stripe API host is one we wrote down. The cost seam
// (`src/lib/costs/`) ledgers what a scan *spends* against its cap; a
// payment is money arriving, not vendor spend a cap could stop, and putting
// it through `withCostContext` would make a customer's purchase cancellable
// by a scan's budget. The mail seam's own vendor client records the same
// reasoning for the same shape (`src/lib/mail/vendor/resend.ts`).
//
// The SDK is constructed lazily and memoised: importing this module must
// not read `env.STRIPE_SECRET_KEY`, so a client bundle that reaches a file
// which merely *type*-imports from here does not throw at load.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-06: Stripe: `PRICE_OBJECT_SPEC` is checked in and built from the three
//   price pins (4900 · eur · month, tax_behavior inclusive, automatic_tax off — ADR-052);
//   CHECKOUT_PARAMS has exactly its declared key set; checkout facts (country, VAT number) are
//   recorded exactly as Stripe reported/the buyer typed; the webhook adapter verifies nothing
//   itself — signature verification is the whole trust boundary inside handleStripeWebhook;
//   two idempotency keys mean two different things (replayed payment vs second purchase).
//   `users.paid_through` is written by #34, not by provisioning. — #123

import Stripe from "stripe";
import { env } from "@/lib/config/env";

let client: Stripe | null = null;

/** The vendor SDK, server-only. `env.STRIPE_SECRET_KEY` is one of the
 *  bindings `src/lib/config/env.ts` marks server-only, so reading it from a
 *  client bundle throws there rather than leaking a key here. */
export function stripe(): Stripe {
  if (client === null) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

/** Swaps the SDK. The suites' one door in; `null` restores the real one.
 *  Typed as the SDK itself so a double that drifts from the API is a
 *  compile error at the double, not a green test against a shape Stripe
 *  stopped having. */
export function setStripe(next: Stripe | null): void {
  client = next;
}

export type { Stripe };
