// SPEC §1 Marketing pages are static: their offer line was read at build, and the browser asks here
// for the count and for a state that moved since the deploy.
import { spotsLeft } from "@/lib/account/offer/spots";
import { offerOf, sentenceOf } from "../../_chrome/offer-sentence";

export const dynamic = "force-dynamic";

/** At the CDN only, with no stale copy: a taken spot shows within 4 minutes. */
const KEPT_S = 240;

export async function GET(): Promise<Response> {
  const spots = await spotsLeft().catch(() => null);
  // Only a page built before the line's 30 days were up asks; it keeps the ended line until the next deploy removes it.
  const line = sentenceOf(spots?.state === "over" ? { ...spots, state: "ended" } : spots, false);
  // Not measured is never 0, and never kept.
  const kept = spots === null ? "no-store" : `public, max-age=0, s-maxage=${KEPT_S}`;
  return Response.json({ ...offerOf(spots, false), line }, { headers: { "Cache-Control": kept } });
}
