// SPEC §1 Landing order: the first-50 offer line above the header, on the selling pages only.
import type React from "react";
import { OFFER_ENDS_AT, OFFER_ENDS_ON, OFFER_SHOWN_DAYS, OFFER_SPOTS, SETUP_MINUTES } from "@/lib/config/constants";
import type { SpotsLeft } from "@/lib/account/offer/spots";
import { copy } from "@/lib/presentation/copy";
import { HOW_FACTS } from "../_how/facts";
import { OfferLineLeaf } from "./OfferLineLeaf";

// A static page built after the line's 30 days draws nothing rather than a line its read would take away.
const OVER_AT_BUILD = Date.now() >= Date.parse(OFFER_ENDS_AT) + OFFER_SHOWN_DAYS * 86_400_000;

/**
 * `spots` is the server's read; left out, a static page asks `/offer/spots` after paint.
 * `pitch` draws the pace and promise from `sm`; `see` links to Pricing.
 */
export function OfferLine(p: { spots?: SpotsLeft | null; pitch: boolean; see: boolean }): React.JSX.Element | null {
  if (p.spots === undefined && OVER_AT_BUILD) return null;
  const of = String(OFFER_SPOTS);
  const price = copy("price.amount");
  const endsOn = OFFER_ENDS_ON;
  return (
    <OfferLineLeaf
      read={p.spots === undefined}
      spots={p.spots ?? null}
      endsAt={Date.parse(OFFER_ENDS_AT)}
      words={{
        label: copy("offer.banner.label"),
        pitch: p.pitch
          ? [copy("offer.banner.pace", { weekPages: String(HOW_FACTS.weekPages), price }), copy("offer.banner.promise", { minutes: String(SETUP_MINUTES) })]
          : [],
        before: copy("offer.spots.before", { of, endsOn }),
        left: copy("offer.spots.left", { left: "{left}", of, endsOn }),
        taken: copy("offer.spots.taken", { of, price }),
        ended: copy("offer.spots.ended", { of, price }),
        see: p.see ? copy("offer.banner.see") : null,
      }}
    />
  );
}
