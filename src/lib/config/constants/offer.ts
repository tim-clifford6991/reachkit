// src/lib/config/constants/offer.ts — the first-50 offer: how many spots, when it closes, when few are left. Imports nothing.

export const OFFER_SPOTS = 50 as const;
/** The end of 31 Jan 2027 UTC: one fixed moment for everyone. */
export const OFFER_ENDS_AT = "2027-02-01T00:00:00Z" as const;
export const OFFER_FEW_LEFT = 4 as const;
/** A full refund this many days after the spot was taken still gives it back. */
export const OFFER_FREE_REFUND_DAYS = 14 as const;
/** The ended or all-taken line stays this many days after the offer closed, then nothing is drawn. */
export const OFFER_SHOWN_DAYS = 30 as const;
