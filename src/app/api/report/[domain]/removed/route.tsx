// BUILD §4.1 — the removed arm, with the status it promises
//
// A report withdrawn on the site owner's written request answers `410
// Gone` at its own address (owner ruling 2026-09-05, #28; the number is
// pinned as `REPORT_REMOVED_STATUS` and travels with its two headers as
// `REMOVED_RESPONSE_INIT`). A Next `page.tsx` cannot set a status — the
// framework offers `notFound` / `forbidden` / `unauthorized` and no
// `gone` — and a page and a route handler cannot share one segment, so the
// body is rendered here and `src/middleware.ts` rewrites a removed
// domain's report address to this handler. A rewrite, never a redirect:
// the visitor stays at `/scan/{domain}`, which is the one address REQ-001
// c2 promises per domain, and gets the right status on it.
//
// **This handler re-checks the removal itself.** It is reachable directly,
// and a 410 for a live report would be a lie a stranger could make the
// product tell. The check is `isDomainRemoved`'s, the same read admission
// makes; a domain that is not removed is answered `404` — this address is
// an internal destination, not a second public report address, so there is
// nothing else for it to be.
//
// **It renders and decides nothing else.** No session, no cookie, no
// header about the visitor, no tier: REQ-002 c1's address must be readable
// by a visitor with no account, session or payment, and a removed one most
// of all. The body is `RemovedView`'s — one written line from the copy
// registry, no control and no route back.
import { renderToStaticMarkup } from "react-dom/server";
import { REMOVED_RESPONSE_INIT, RemovedView } from "@/app/(public)/scan/[domain]/_address/removal";
import { isDomainRemoved } from "@/lib/scan/admission";
import { parseDomain } from "@/lib/scan/domain";

/** The `Content-Type` this handler adds to `REMOVED_RESPONSE_INIT`'s own
 *  two headers. Kept here and not in that value: the status, the robots
 *  directive and the cache policy are the *policy*, which `removal.tsx`
 *  owns, and this is a fact about the bytes this one handler writes. */
const HTML = "text/html; charset=utf-8";

function removedResponse(body: string): Response {
  const headers = new Headers(REMOVED_RESPONSE_INIT.headers);
  headers.set("Content-Type", HTML);
  return new Response(`<!doctype html>${body}`, { ...REMOVED_RESPONSE_INIT, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
): Promise<Response> {
  const { domain: segment } = await params;
  const parsed = parseDomain(decodeURIComponent(segment));
  if (!parsed.ok) return new Response(null, { status: 404 });

  if (!(await isDomainRemoved(parsed.domain))) {
    return new Response(null, { status: 404 });
  }

  return removedResponse(renderToStaticMarkup(<RemovedView domain={parsed.domain} />));
}
