// src/app/(public)/pricing/state.ts — SPEC.md §3 (issue #624)
//
// The marker a refused checkout comes back with. A plain module, on the
// terms `src/app/(public)/signin/state.ts` established: `./actions.ts` is a
// `"use server"` file and may export only async functions.

import { CHECKOUT_QUERY_KEY, LIMITED_MARKER, REFUSED_MARKER } from "@/lib/account/identity/addresses";

export { CHECKOUT_QUERY_KEY, LIMITED_MARKER, REFUSED_MARKER };

export type CheckoutRefusal = typeof REFUSED_MARKER | typeof LIMITED_MARKER;

/** The refusal a `checkout` query value names, or `null` for anything else. */
export function refusalIn(value: string | null | undefined): CheckoutRefusal | null {
  return value === REFUSED_MARKER || value === LIMITED_MARKER ? value : null;
}

/** This surface's own address — the one both `returnTo` and the refused
 *  landing are built from. */
export const PRICING_PATH = "/pricing";

export interface PricingSearchParams {
  [CHECKOUT_QUERY_KEY]?: string;
}
