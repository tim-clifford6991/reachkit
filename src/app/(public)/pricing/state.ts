// src/app/(public)/pricing/state.ts — SPEC.md §3 (issue #624)
//
// The marker a refused checkout comes back with. A plain module, on the
// terms `src/app/(public)/signin/state.ts` established: `./actions.ts` is a
// `"use server"` file and may export only async functions.

/** The query key a refused checkout returns with. Success no longer lands
 *  here — Stripe sends a completed payment to `/auth/checkout`. Not
 *  customer copy — a wire name the page reads, never a sentence a person
 *  is shown. */
export const CHECKOUT_QUERY_KEY = "checkout";

/** The value the refused arm carries. */
export const REFUSED_MARKER = "refused";

/** This surface's own address — the one both `returnTo` and the refused
 *  landing are built from. */
export const PRICING_PATH = "/pricing";

/** Where a refused purchase lands: this surface, with the marker on it, so
 *  the offer comes back with its written line and an HTTP 200 rather than a
 *  thrown error and a 500. */
export const REFUSED_PATH = `${PRICING_PATH}?${CHECKOUT_QUERY_KEY}=${REFUSED_MARKER}`;

export interface PricingSearchParams {
  [CHECKOUT_QUERY_KEY]?: string;
}
