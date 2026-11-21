// The offer line's one sentence, composed on the server so a page's HTML carries no other arm's words.
import { OFFER_ENDS_ON, OFFER_SPOTS } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { copy } from "@/lib/presentation/copy";

/** `closed` is drawn alone, without the pitch or the link; `few` is drawn bold with the clock on a selling page. */
export type Said = { text: string; mark: "count" | "few" | "closed" };

/** `built` drops the count, which a static page would keep until the next deploy. */
export function sentenceOf(spots: SpotsLeft | null, built: boolean): Said | null {
  if (spots === null || spots.state === "over") return null;
  const of = String(OFFER_SPOTS);
  const price = copy("price.amount");
  if (spots.state === "full") return { text: copy("offer.spots.taken", { of, price }), mark: "closed" };
  if (spots.state === "ended") return { text: copy("offer.spots.ended", { of, price }), mark: "closed" };
  if (built || spots.left === undefined) return { text: copy("offer.spots.before", { of, endsOn: OFFER_ENDS_ON }), mark: "count" };
  return { text: copy("offer.spots.left", { left: String(spots.left), of, endsOn: OFFER_ENDS_ON }), mark: spots.state === "few" ? "few" : "count" };
}
