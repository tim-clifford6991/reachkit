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
// **No report address, ever** (ADR-002 decision 1: report pages are
// `noindex` forever and in no sitemap). Nothing here can name one: the only
// URLs it emits are the live URLs of hosted publications, and a report
// address is neither.
//
// **Never cached**: an unpublished page leaves this document at the moment
// its row changes (WO-028's NFR), not after a TTL.
//
// The archived plan is WO-231.
import { livePagesForSite } from "@/lib/publish/destinations/hosted";
import { resolveHost } from "../resolve-host";

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
  const disposition = await resolveHost(request.headers.get("host") ?? "");
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
