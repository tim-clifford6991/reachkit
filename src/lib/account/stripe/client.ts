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
