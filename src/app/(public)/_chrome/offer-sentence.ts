// The offer's words, composed on the server so a page's HTML carries no other arm's words.
import { OFFER_ENDS_ON, OFFER_SPOTS } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { offerOpen, type Offer } from "@/lib/account/offer/open";
import { copy } from "@/lib/presentation/copy";

/** `closed` is drawn alone, without the pitch or the link; `few` is drawn bold with the clock on a selling page. */
export type Said = { text: string; mark: "count" | "few" | "closed" };

/** The offer line's sentence for a read, `null` where it failed; `built` drops the count, which a static page would keep until the next deploy. */
export function sentenceOf(spots: SpotsLeft | null, built: boolean): Said | null {
  if (spots?.state === "over") return null;
  const of = String(OFFER_SPOTS);
  const price = copy("price.amount");
  if (!offerOpen(spots?.state ?? "unknown")) {
    return { text: spots?.state === "full" ? copy("offer.spots.taken", { of, price }) : copy("offer.spots.ended", { of, price }), mark: "closed" };
  }
  if (built || spots?.left === undefined) return { text: copy("offer.spots.before", { of, endsOn: OFFER_ENDS_ON }), mark: "count" };
  return { text: copy("offer.spots.left", { left: String(spots.left), of, endsOn: OFFER_ENDS_ON }), mark: spots.state === "few" ? "few" : "count" };
}

/** The card's and the bar's read, `null` where it failed. */
export function offerOf(spots: SpotsLeft | null, built: boolean): Offer {
  const state = spots?.state ?? "unknown";
  const open = offerOpen(state);
  const left = built || !open ? undefined : spots?.left;
  return { state, open, count: left === undefined ? null : copy("offer.card.left", { left: String(left), of: String(OFFER_SPOTS) }) };
}
