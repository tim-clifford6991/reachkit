// BUILD §6.6 — the swap offer: a destination, never a change to the set.
//
// The archived plan is WO-088. REQ-096 c6 says a rival the customer could
// not catch comes with one control that takes them to where they can
// replace it. This module produces that control's *state* and its
// destination handle, and nothing else — in particular it exports no
// mutation of the rival set and no suggested replacement.
//
// **"The product removed my rival" is not a bug that can be written
// here.** REQ-096 c7 forbids the product narrowing the set on its own
// judgement, and this file holds that by having nowhere to put it: it
// takes one `RivalSize` and returns one small record, it imports nothing
// that can write, it returns no array, and it exports no function over a
// rival set. The actual replacement is the founder's, made at the
// competitors card, through `addRival`/`removeRival`.
//
// **No string.** The written line c6 requires — the one saying the rival
// is far beyond what they could catch and why the distance will not move —
// is the owner's and is still owed; it belongs to the surface that renders
// the offer, not here. Neither it nor the three ruled band words appear in
// this file, and it resolves no import into `src/lib/presentation/`.
//
// `destination` is a handle, not a URL and not a sentence: route
// resolution is the surface's.
import type { RivalSize } from "./size";

export type SwapOffer =
  | { offered: false }
  | { offered: true; rival: string; destination: "settings.competitors" };

/**
 * Offered exactly when the rival has been sized and its band is `far`.
 *
 * One condition covers both edges: an `unsized` rival is never offered —
 * nothing on its row may imply a band it does not have — and a stale
 * `far` rival still is, because a stale `far` band is still a `far` band
 * and `RivalSize` already carries the date that says how old it is.
 *
 * Pure and total: the same value in gives the same value out, the
 * argument is not touched, and nothing is emitted. WO-088 asks for one
 * observability field — whether the offer fired — and `sizeRivals`
 * already carries it: the offer fires on exactly the `far` band its
 * `rival_sizing` line records, so a line here would be the same fact
 * written twice, once per rival per render.
 */
export function swapOffer(s: RivalSize): SwapOffer {
  return s.state === "sized" && s.band === "far"
    ? { offered: true, rival: s.domain, destination: "settings.competitors" }
    : { offered: false };
}
