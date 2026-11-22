// SPEC §1 Landing order: the first-50 offer line above the header, on the selling pages only.
import type React from "react";
import { SETUP_MINUTES } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { offerOpen } from "@/lib/account/offer/open";
import { copy } from "@/lib/presentation/copy";
import { HOW_FACTS } from "../_how/facts";
import { OfferLineLeaf } from "./OfferLineLeaf";
import { sentenceOf } from "./offer-sentence";

/**
 * `spots` is the server's read on a per-request page; left out, a static page reads it at build and
 * the browser fills the count from `/offer/spots`.
 * `pitch` draws the pace and promise from `sm`; `see` links to Pricing.
 */
export async function OfferLine(p: { spots?: SpotsLeft | null; pitch: boolean; see: boolean }): Promise<React.JSX.Element | null> {
  const read = p.spots === undefined;
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const spots = read ? await import("@/lib/account/offer/spots").then((m) => m.spotsLeft()).catch(() => null) : (p.spots ?? null);
  // A static page whose build read failed holds nothing from the end date, so its HTML never keeps an empty "Offer".
  if (spots?.state === "over" || (read && spots === null && !offerOpen("unknown"))) return null;
  const price = copy("price.amount");
  return (
    <OfferLineLeaf
      read={read}
      said={sentenceOf(spots, read)}
      words={{
        label: copy("offer.banner.label"),
        pitch: p.pitch
          ? [copy("offer.banner.pace", { weekPages: String(HOW_FACTS.weekPages), price }), copy("offer.banner.promise", { minutes: String(SETUP_MINUTES) })]
          : [],
        see: p.see ? copy("offer.banner.see") : null,
      }}
    />
  );
}
