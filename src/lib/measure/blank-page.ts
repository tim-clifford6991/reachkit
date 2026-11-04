// A home page of the site's own that says nothing of what the business
// sells: an empty shell its script fills in a browser, or a page with no
// words at all. Its market is read from its listing in search, as for a home
// behind bot protection, and never from the page.
import { HOME_TEXT_FLOOR_CHARS } from "@/lib/config/constants/scan";
import { BOT_PROTECTION, challengeOf } from "./challenge";
import { visibleText } from "./parse";

/** The `because` of a stored market read off a home page with no words of
 *  the site's own: its next pass reads the market from its listing. */
export const HOME_WORDLESS = "home_wordless";

/** Whether a home page's visible text is too little to say what the
 *  business sells. */
export function saysNothing(html: string): boolean {
  return visibleText(html).length < HOME_TEXT_FLOOR_CHARS;
}

/** Why a read page holds none of the site's words — a protection's page, or
 *  one that says nothing — or `null` where it is the site's. */
export function unreadPageOf(html: string): typeof BOT_PROTECTION | typeof HOME_WORDLESS | null {
  if (challengeOf({ status: 200, html }) !== null) return BOT_PROTECTION;
  return saysNothing(html) ? HOME_WORDLESS : null;
}

export interface BlankHome {
  /** The home page is the site's own and says nothing of what it sells
   *  (`saysNothing`): its market is read from its listing. */
  homeWordless?: true;
}

/** The measurement's mark of a home page that says nothing. */
export function blankHomeOf(html: string | null): BlankHome {
  return html !== null && saysNothing(html) ? { homeWordless: true } : {};
}

/** Issue 1387: a site whose own pages stay unread, or say nothing, has its
 *  market read from its ranked rows, so they are bought carrying what
 *  Google shows for each: the same one purchase. */
export function listingWanted(a: { unread: boolean; html: string | null }): { listing?: true } {
  return a.unread || (a.html !== null && saysNothing(a.html)) ? { listing: true } : {};
}
