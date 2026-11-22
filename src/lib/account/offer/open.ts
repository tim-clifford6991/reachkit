// The first-50 offer's one open-or-closed rule, for the server and the browser alike; it imports no database.
import { OFFER_ENDS_AT } from "@/lib/config/constants";
import type { SpotsLeft } from "./spots";

/** `unknown` is a read that failed, or one a static page has not made yet. */
export type SpotsState = SpotsLeft["state"] | "unknown";

/** What the card and the bar draw: `count` only while open and a number was read, so never a 0. */
export type Offer = { state: SpotsState; open: boolean; count: string | null };

/** Open before the end date while the read says open or few; a failed read counts as open, with no number. */
export function offerOpen(state: SpotsState, now: number = Date.now()): boolean {
  return now < Date.parse(OFFER_ENDS_AT) && (state === "open" || state === "few" || state === "unknown");
}
