// BUILD §9 — `GET /robots.txt`, on whichever host asked.
//
// One route, two documents, and the Host decides which (`policies.ts`
// holds both and they share no helper). A `content.` host that resolves to
// a site gets the policy that permits the six pinned AI readers by name and
// blocks no general crawler; a `{slug}.reachkit.app` preview gets the
// document that indexes nothing, forever (ADR-002).
//
// **Every other host is answered 404, which is what it was before this
// route existed.** ReachKit's own address publishes no robots policy from
// here: the app's indexing rules are `next.config.ts`'s `X-Robots-Tag` for
// `/scan/:domain` and each route's own `metadata`, and quietly taking over
// the product's own `/robots.txt` from inside the hosted edge would be a
// policy change nobody asked for. `resolveHost` subtracts this
// deployment's own hostname from the preview suffix's children, so the
// deployment is `unknown` here and not a preview.
//
// **Never cached**: a customer who leaves stops being served immediately,
// and a robots document held in a proxy would outlive them.
import { hostedHostFor } from "@/lib/publish/destinations/hosted";
import { customerRobotsDocument, previewRobotsDocument } from "../policies";
import { resolveHost } from "../resolve-host";

const TEXT = "text/plain; charset=utf-8";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");

  if (disposition.kind === "site") {
    // The sitemap the document names is this site's own, on the customer's
    // own domain — composed from the Host that resolved, never from ours
    // and never from `request.url`, which a proxy may have rewritten.
    const sitemapUrl = `https://${hostedHostFor(disposition.domain)}/sitemap.xml`;
    return new Response(customerRobotsDocument(sitemapUrl), {
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": TEXT },
    });
  }

  if (disposition.kind === "preview") {
    return new Response(previewRobotsDocument(), {
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": TEXT, "X-Robots-Tag": "noindex" },
    });
  }

  // `gone` and `unknown` alike: a host we do not serve publishes no policy
  // of ours.
  return new Response(null, { status: 404 });
}
