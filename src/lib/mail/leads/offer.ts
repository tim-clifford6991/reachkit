// BUILD §4.2 — the one offer the report's free-page card and the giveaway mail both read, returned as data so they cannot disagree.
// `{ offered: false }` is criterion 6, the absence of a card, so it carries no `title`. `volume` and `rival` stay `Measured<T>` (REQ-091 c3).
// Reading an offer writes and gates nothing: the rest of the report is readable whether or not anyone types an address.
import type { Measured } from "@/lib/measure/measured";
import { readOffer } from "./ports";

export type FirstPageOffer =
  | { offered: false }
  | {
      offered: true;
      /** §8's proposed title — model text, labelled where it renders. */
      title: string;
      /** The N of "page 1 of N". */
      pagesFound: number;
      targetQuery: string;
      volume: Measured<number>;
      rival: Measured<string>;
      format: string;
    };

/** An unreadable offer is not "no offer": the card shows nothing either way, but `deliverFirstPage` must not tell a founder their scan found nothing. */
export type OfferRead = { read: true; offer: FirstPageOffer } | { read: false };

export async function readFirstPageOffer(scanId: string): Promise<OfferRead> {
  const result = await readOffer(scanId);
  if (!result.read) return { read: false };
  if (result.page === null) return { read: true, offer: { offered: false } };

  const page = result.page;
  return {
    read: true,
    offer: {
      offered: true,
      title: page.title,
      pagesFound: page.pagesFound,
      targetQuery: page.targetQuery,
      volume: page.volume,
      rival: page.rival,
      format: page.format,
    },
  };
}

/** The card's entry point: an unreadable offer shows no card, as there is nothing honest to put in one. */
export async function firstPageOffer(scanId: string): Promise<FirstPageOffer> {
  const result = await readFirstPageOffer(scanId);
  return result.read ? result.offer : { offered: false };
}
