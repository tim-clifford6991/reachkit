// BUILD §9 — `GET /sitemap.xml`, exactly this site's live pages and nothing
// else.
//
// §9: a published hosted page "is listed in a sitemap". This is that
// sitemap, and its whole contract is what it may *not* contain: another
// site's page, a page in any state but live, a preview address, or a
// ReachKit address. Every entry is `publications.live_url` for a `hosted`
// publication of the site the Host resolved to, which is the same predicate
// the page render reads (`livePagesForSite`) — so a page cannot be absent
// from the sitemap and present at its address, or the reverse.
//
// **A site with no live page gets a valid, empty sitemap**, never an error
// and never a 404: an empty index is a true statement about a site that has
// published nothing yet, and REQ-062's 24-hour check reads this document
// for pages that are not there yet.
//
// **ReachKit's own address is answered too** (issue #326). BUILD §3 lists
// `/sitemap.xml` among the public routes, and this is the one route file
// Next will let answer that path, so the app host gets the sitemap of its
// own indexable public routes — composed under `(public)`, from the same
// table each of those routes reads its `robots` directive off, so a route
// cannot be listed here and told not to be indexed. Every other host is
// 404, exactly as before.
//
// **No report address, ever** (ADR-002 decision 1: report pages are
// `noindex` forever and in no sitemap). Neither document can name one: the
// hosted arm emits only the live URLs of hosted publications, and the app
// arm only the `indexable` rows of `_seo/routes.ts`, where the report's is
// not.
//
// **Never cached**: an unpublished page leaves this document at the moment
// its row changes (WO-028's NFR), not after a TTL.
//
// The archived plan is WO-231.
import { env } from "@/lib/config/env";
import { livePagesForSite } from "@/lib/publish/destinations/hosted";
import { appSitemapDocument } from "@/app/(public)/_seo/policies";
import { isAppHost, resolveHost } from "../resolve-host";

const XML = "application/xml; charset=utf-8";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The five characters XML reserves. A live URL is composed from a domain
 *  and a slug and should carry none of them; escaping is not a promise
 *  about the input, it is what keeps a malformed one from producing a
 *  malformed document. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";

  // ReachKit's own address, before any lookup: it is not a customer, and
  // its sitemap is a fixed table rather than a query.
  if (isAppHost(host)) {
    return new Response(appSitemapDocument(env.NEXT_PUBLIC_APP_URL), {
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": XML },
    });
  }

  const disposition = await resolveHost(host);
  // A preview address is in no sitemap (ADR-002), and neither is a host we
  // do not serve or one that has stopped.
  if (disposition.kind !== "site") return new Response(null, { status: 404 });

  const pages = await livePagesForSite(disposition.siteId);
  const entries = pages
    .map(
      (page) =>
        `  <url><loc>${xmlEscape(page.liveUrl)}</loc>` +
        `<lastmod>${page.publishedAt.toISOString().slice(0, 10)}</lastmod></url>`
    )
    .join("\n");

  const document =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    (entries === "" ? "" : `${entries}\n`) +
    "</urlset>\n";

  return new Response(document, {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": XML },
  });
}
