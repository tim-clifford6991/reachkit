// BUILD §9 — `GET /robots.txt`, on whichever host asked.
//
// One route, two documents, and the Host decides which. A `content.`
// host that resolves to a site gets the policy that permits the pinned AI
// readers by name and blocks no general crawler (`(hosted)/policies.ts`);
// ReachKit's own address gets the one that allows the whole site and names
// our own sitemap (`(public)/_seo/policies.ts`). They share no helper — a
// merged, parameterised template is one tidy-up away from serving the
// wrong policy on the wrong host. This is the one route file Next will let
// answer that path, so both live behind it. Every other host is 404.
//
// The app host is asked for by name rather than read off the disposition:
// `resolveHost` folds it into `unknown` together with every stranger, and
// telling the two apart is `isAppHost`'s job.
//
// **Never cached**: a customer who leaves stops being served immediately,
// and a robots document held in a proxy would outlive them.
import { env } from "@/lib/config/env";
import { appRobotsDocument } from "@/app/(public)/_seo/policies";
import { customerRobotsDocument } from "../policies";
import { isAppHost, resolveHost, unavailableResponse } from "../resolve-host";

const TEXT = "text/plain; charset=utf-8";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";

  // ReachKit's own address, before any lookup: the app host is not a
  // customer and asking the store about it would be a round trip for an
  // answer that is fixed. The sitemap it names is composed from the bound
  // origin and never from `request.url`, which a proxy may have rewritten.
  if (isAppHost(host)) {
    return new Response(appRobotsDocument(new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString()), {
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": TEXT },
    });
  }

  const disposition = await resolveHost(host);
  if (disposition.kind === "unavailable") return unavailableResponse();

  if (disposition.kind === "site") {
    // The sitemap the document names is this site's own, on the customer's
    // own domain — composed from the Host that resolved, never from ours
    // and never from `request.url`, which a proxy may have rewritten.
    const sitemapUrl = `https://${disposition.host}/sitemap.xml`;
    return new Response(customerRobotsDocument(sitemapUrl), {
      status: 200,
      headers: { "Cache-Control": "no-store", "Content-Type": TEXT },
    });
  }

  // `gone` and `unknown` alike: a host we do not serve publishes no policy
  // of ours.
  return new Response(null, { status: 404 });
}
