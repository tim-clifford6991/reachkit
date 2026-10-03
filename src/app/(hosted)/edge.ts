// BUILD §9 — which of the hosted edge's two answers an address gets, decided
// once, before anything renders.
//
// `src/middleware.ts` calls this and nothing else does. It exists because a
// Next `page.tsx` cannot set a status — the framework offers
// `notFound`/`forbidden`/`unauthorized` and no `gone` — so the one thing
// that has to be settled before routing is whether this address answers
// `410 Gone` or renders. Everything else the edge does (which page, which
// robots document, which sitemap) is decided inside the route that serves
// it, from the same `resolveHost`.
//
// **`gone` and `not found` are two different statements** and this is where
// they are told apart. An address that served a page and no longer does is
// `Gone`; an address that never served one is `Not found`, and answering
// 410 for it would be a claim about a page that never existed.
//
// **A re-published page is not gone.** The live check comes first, so a
// slug that was unpublished and later published again answers with the
// page — the `unpublished` rows behind it are history, not a verdict.
//
// **One narrow read for the address** (issue 1194). This runs before
// routing on every request to a customer's host, inside the middleware's
// deadline, so it asks `hostedAddressState` — three short columns — and
// never loads a page. The page route loads the page, once, if there is one.
//
// **It fails towards rendering.** A read that throws yields `page`, and the
// page route answers 404 when it cannot find one. A 410 asserts that a page
// was taken down; it is never something to say because a query failed.
import { hostedAddressState } from "@/lib/publish/destinations/hosted";
import { resolveHost } from "./resolve-host";

export type HostedAnswer = "gone" | "page";

/** The single path segment that names a page, or `null` — `content.{domain}
 *  /a/b` is not a deeper page, it is not a page at all. */
export function pageSlug(pathname: string): string | null {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return segments.length === 1 ? (segments[0] ?? null) : null;
}

export async function hostedAnswer(host: string, pathname: string): Promise<HostedAnswer> {
  try {
    const disposition = await resolveHost(host);
    // A customer whose access ended, or whose account was deleted: every
    // address on the host is gone, not only the ones that held a page.
    if (disposition.kind === "gone") return "gone";
    if (disposition.kind !== "site") return "page";

    const slug = pageSlug(pathname);
    if (slug === null) return "page";

    return (await hostedAddressState(disposition.siteId, slug)) === "retired" ? "gone" : "page";
  } catch {
    return "page";
  }
}
