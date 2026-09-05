// src/lib/presentation/offer.ts — BUILD §4.1 module 6, REQ-021 c2/c4 (issue #19)
//
// "**Pricing card**: €49/mo + four spec rows (1/day · weekly · weekly · 24h
// veto) + Start button + 'Cancel in one click.'" — BUILD §4.1 module 6, the
// one place the offer's terms are stated. REQ-021 criterion 4 makes the
// scanless price surface state them "on the same terms the offer at the end
// of a report states (criterion 2)", so the list is derived once, here, and
// both surfaces iterate it: "criterion 4's 'on the same terms' is a type,
// not a habit" (BP-031's own words for this interface).
//
// Values are pins (`src/lib/config/constants.ts`); words are copy keys. This
// module mints no number and writes no sentence.
//
// **Deviation from BP-031's transcribed shape, taken here and flagged in the
// pull request (constitution rule 1.1).** BP-031's `OfferTerms` declares
// `offer.cadence.page` and `offer.veto.window` as carrying `value: number`
// ("pages written per day", "default veto hours"). The owner then ruled the
// four sentences on 2026-09-04 (WO-041 `## Log`), and they do not take a
// bare number: "One new page written for your site {value}" and "Every page
// waits {value} for you to stop it before it goes live …" read as nonsense
// filled with `1` and `24`. The slot each ruled sentence actually takes is a
// cadence phrase — which is what BP-031's other two rows already supply
// ('weekly', a word, not a number). So `value` is `string` throughout here,
// and the four phrases are derived below from the pins the blueprint named.
// Reversal cost: this file alone. What is genuinely chosen rather than
// transcribed — "every day" for `publishesPerDay === 1`, and the unit word
// "hours" beside `VETO.defaultHours` — is named in the pull request for the
// owner to rule; nothing here is a sentence, only the phrase a slot takes.
import { RATE_LIMITS, VETO } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";

/** The copy keys every price-bearing surface must render (BP-030,
 *  `PRICE_COPY_KEYS`). Naming only — the sentences are the owner's and live
 *  in the copy registry (REQ-093). Declared here rather than beside
 *  `createCheckoutSession` so that a surface stating the price imports no
 *  part of the payments seam to do it. */
export const PRICE_COPY_KEYS = [
  "price.amount",
  "price.vat_included",
  "price.interval",
] as const satisfies readonly CopyKey[];

/** One row of the offer: the key whose sentence states it, and the phrase
 *  that sentence's one `{value}` slot takes. */
export interface OfferRow {
  key: CopyKey;
  value: string;
}

/** REQ-021 criterion 2's closed list, in the order every surface states it. */
export interface OfferTerms {
  priceKeys: typeof PRICE_COPY_KEYS;
  rows: readonly [OfferRow, OfferRow, OfferRow, OfferRow];
  cancelKey: "offer.cancel_self_service";
  startKey: "offer.start";
}

/** The one word BP-031's own interface already supplies as a word rather
 *  than a number, for the two rows BUILD §4.1 module 6 spells "weekly ·
 *  weekly". Written once so the two rows cannot drift apart. */
const WEEKLY = "weekly";

/** `RATE_LIMITS.publishesPerDay` is the pin behind BUILD §4.1's "1/day".
 *  The phrase below is the reading of that pin at its pinned value;
 *  `tests/app/pricing/offer.test.ts` asserts the pin still is that value,
 *  so a changed cadence fails a test rather than silently mis-stating the
 *  offer. */
const PAGE_CADENCE = RATE_LIMITS.publishesPerDay === 1 ? "every day" : `${RATE_LIMITS.publishesPerDay} times a day`;

/** BUILD §4.1's "24h veto", read from its pin with its unit. */
const VETO_WINDOW = `${VETO.defaultHours} hours`;

export function offerTerms(): OfferTerms {
  return {
    priceKeys: PRICE_COPY_KEYS,
    rows: [
      { key: "offer.cadence.page", value: PAGE_CADENCE },
      { key: "offer.cadence.measure", value: WEEKLY },
      { key: "offer.cadence.movement", value: WEEKLY },
      { key: "offer.veto.window", value: VETO_WINDOW },
    ],
    cancelKey: "offer.cancel_self_service",
    startKey: "offer.start",
  };
}
