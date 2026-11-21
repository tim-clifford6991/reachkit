// SPEC §1 Landing order: the first-50 offer line above the header, on the selling pages only.
import type React from "react";
import { OFFER_ENDS_AT, OFFER_SHOWN_DAYS, SETUP_MINUTES } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { copy } from "@/lib/presentation/copy";
import { HOW_FACTS } from "../_how/facts";
import { OfferLineLeaf } from "./OfferLineLeaf";
import { sentenceOf } from "./offer-sentence";

/** The line's 30 days after the end are up, whatever the count. */
const pastShownDays = (): boolean => Date.now() >= Date.parse(OFFER_ENDS_AT) + OFFER_SHOWN_DAYS * 86_400_000;

/**
 * `spots` is the server's read on a per-request page; left out, a static page reads it at build and
 * the browser fills the count from `/offer/spots`.
 * `pitch` draws the pace and promise from `sm`; `see` links to Pricing.
 */
export async function OfferLine(p: { spots?: SpotsLeft | null; pitch: boolean; see: boolean }): Promise<React.JSX.Element | null> {
  const read = p.spots === undefined;
  // Loaded here, not at the top: the database client checks its environment when it loads.
  const spots = read ? await import("@/lib/account/offer/spots").then((m) => m.spotsLeft()).catch(() => null) : (p.spots ?? null);
  // A failed server read can say nothing true after the end; a failed build read leaves the line to the browser until the line's 30 days are up.
  if (spots === null ? !read || pastShownDays() : spots.state === "over") return null;
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
