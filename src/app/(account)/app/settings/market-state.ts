// BUILD §4.7 — the shape the market and competitors forms carry between a
// submit and the answer they get back.
//
// A file of its own for the reason `./account-state.ts` is one: a
// `"use server"` module may export only async functions, so the state, its
// initial value, the fields' wire names and the two refusal maps cannot
// live beside the Server Functions that produce them. Both this file's
// importers — `./change-actions.ts` and the two panels — need all of them.
//
// **One state for all four forms.** Domain, category, add-a-rival and
// remove-a-rival answer the same three things: nothing yet, saved with a
// date, or refused with a line and the value kept. REQ-071 gives all of
// them the same clock and the same consequence (`MarketPanel` says why the
// card states it once), so a separate state per control would be four
// copies of one answer.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RivalRefusal } from "@/lib/market/setup/rivals";

/** The native `name` on each field. Internal (rule 1.1), not sentences:
 *  they are wire names a browser puts in `FormData`, which is why `Input`
 *  takes a `name` prop at all. */
export const MARKET_DOMAIN_FIELD = "market_domain";
export const MARKET_CATEGORY_FIELD = "market_category";
export const RIVAL_FIELD = "rival_domain";

export type MarketChangeState =
  /** Nothing submitted yet in this render. */
  | { answer: "idle" }
  /** Written. `effectiveOn` is the ISO instant the seam answered with —
   *  the date is written on the screen, in the customer's own zone, by the
   *  one formatter the rest of the screen uses. */
  | { answer: "saved"; effectiveOn: string }
  /** Refused, and nothing was written. `value` is what they typed, kept
   *  intact — `Input`'s contract ("the invalid value stays intact"): a
   *  customer told a domain is already in the set must not also have to
   *  retype it. */
  | { answer: "refused"; lineKey: CopyKey; value: string };

export const MARKET_CHANGE_INITIAL: MarketChangeState = { answer: "idle" };

/** The written line a state owes, or `null`. `idle` and `saved` own no
 *  refusal: what a save did is the dated line the card states either way. */
export function refusalKeyOf(state: MarketChangeState): CopyKey | null {
  return state.answer === "refused" ? state.lineKey : null;
}

/** The instant a save answered with, or `null` — read by the card so a
 *  successful save states REQ-071 c6's effective date without waiting for
 *  the revalidated read to come back. */
export function savedInstantOf(state: MarketChangeState): string | null {
  return state.answer === "saved" ? state.effectiveOn : null;
}

/** `saveDomain`'s one refusal (REQ-071 c9). A single member and still a
 *  map, for the reason the five below are one: the union is the engine's,
 *  so a second refusal there is a compile error here rather than a
 *  refusal that says nothing. */
export const DOMAIN_REFUSAL_KEY: Readonly<Record<"unreachable", CopyKey>> = {
  unreachable: "settings.market.refused.unreachable",
};

/** `addRival`'s own five (REQ-071 c4 — "the same rules"), each with this
 *  screen's own sentence. Total over `RivalRefusal`, so a sixth refusal in
 *  `setup/rivals.ts` does not reach a customer as silence. */
export const RIVAL_REFUSAL_KEY: Readonly<Record<RivalRefusal, CopyKey>> = {
  not_a_domain: "settings.competitors.refused.not-a-domain",
  does_not_resolve: "settings.competitors.refused.does-not-resolve",
  own_domain: "settings.competitors.refused.own-domain",
  already_present: "settings.competitors.refused.already-present",
  set_full: "settings.competitors.refused.set-full",
};
