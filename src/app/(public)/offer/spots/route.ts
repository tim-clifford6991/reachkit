// SPEC §1 Marketing pages are static: `/` and `/pricing` read the offer's count here,
// in the browser, so their static HTML never decides it.
import { spotsLeft } from "@/lib/account/offer/spots";

export const dynamic = "force-dynamic";

/** At the CDN only, with no stale copy: a taken spot shows within 4 minutes. */
const KEPT_S = 240;

export async function GET(): Promise<Response> {
  const spots = await spotsLeft().catch(() => null);
  // Not measured is never 0: every reader keeps the before-count line.
  if (spots === null) return Response.json({ state: "unknown" }, { headers: { "Cache-Control": "no-store" } });
  return Response.json(spots, { headers: { "Cache-Control": `public, max-age=0, s-maxage=${KEPT_S}` } });
}
