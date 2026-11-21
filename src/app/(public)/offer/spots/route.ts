// SPEC §1 Marketing pages are static: their offer line was read at build, and the browser asks here
// for the count and for a state that moved since the deploy.
import { spotsLeft } from "@/lib/account/offer/spots";
import { OFFER_ENDS_AT, OFFER_ENDS_ON, OFFER_SPOTS } from "@/lib/config/constants";
import { sentenceOf } from "../../_chrome/offer-sentence";

export const dynamic = "force-dynamic";

/** At the CDN only, with no stale copy: a taken spot shows within 4 minutes. */
const KEPT_S = 240;

export async function GET(): Promise<Response> {
  const spots = await spotsLeft().catch(() => null);
  if (spots === null) {
    // Not measured is never 0: a line with no number, the ended one once the date has passed.
    const unread = { of: OFFER_SPOTS, endsOn: OFFER_ENDS_ON, state: Date.now() >= Date.parse(OFFER_ENDS_AT) ? "ended" : "open" } as const;
    return Response.json({ state: "unknown", line: sentenceOf(unread, true) }, { headers: { "Cache-Control": "no-store" } });
  }
  // Only a page built before the line's 30 days were up asks; it keeps the ended line until the next deploy removes it.
  const line = sentenceOf(spots.state === "over" ? { ...spots, state: "ended" } : spots, false);
  return Response.json({ ...spots, line }, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${KEPT_S}` } });
}
