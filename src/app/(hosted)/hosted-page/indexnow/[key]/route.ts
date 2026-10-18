// SPEC §7 (2026-10-18, issue 1511) — the IndexNow key file, at the root of
// the customer's own host.
//
// IndexNow accepts a submission for a host only from whoever serves the key
// at `https://{host}/{key}.txt`. The middleware rewrites that one path on a
// customer's host to this route, before the address read a page would cost.
// The key is the site's own (`indexNowKey`), stable and never a secret: the
// protocol publishes it by design. Any other name is 404, as is any host
// that is not a site served now.
import { indexNowKey } from "@/lib/publish/destinations/hosted/announce";
import { resolveHost } from "../../../resolve-host";

export const dynamic = "force-dynamic";

const NOT_FOUND = (): Response => new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");
  if (disposition.kind !== "site") return NOT_FOUND();
  const key = indexNowKey(disposition.siteId);
  if ((await params).key !== key) return NOT_FOUND();
  return new Response(key, {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
