// SPEC §1 Marketing pages are static: the landing's logo band reads its slides
// here, in the browser, so `/`'s static HTML names no third party.
import { readRecent } from "@/lib/scan/gallery";
import { LOGO_BAND } from "../../_landing/sections";

export const dynamic = "force-dynamic";

/** At the CDN only, with no stale copy: a removed site leaves the band within 5 minutes. */
const KEPT_S = 240;

export async function GET(): Promise<Response> {
  const entries = await readRecent(LOGO_BAND.read).catch(() => null);
  if (entries === null) return Response.json({ entries: [] }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { entries: entries.map(({ domain, company }) => ({ domain, company })) },
    { headers: { "Cache-Control": `public, max-age=0, s-maxage=${KEPT_S}` } },
  );
}
