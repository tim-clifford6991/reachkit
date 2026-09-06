// BUILD §4.1 — the removed arm, with the status it promises
//
// A report withdrawn on the site owner's written request answers `410
// Gone` at its own address (owner ruling 2026-09-05, #28; the number is
// pinned as `REPORT_REMOVED_STATUS` and travels with its two headers as
// `REMOVED_RESPONSE_INIT`). A Next `page.tsx` cannot set a status, and a
// page and a route handler cannot share one segment, so the body is served
// here and `src/middleware.ts` rewrites a removed domain's report address
// to this handler. A rewrite, never a redirect: the visitor stays at
// `/scan/{domain}`, the one address REQ-001 c2 promises per domain, and
// gets the right status on it.
//
// **This handler re-checks the removal itself.** It is reachable directly,
// and a 410 for a live report would be a lie a stranger could make the
// product tell. A domain that is not removed is answered `404` — this
// address is an internal destination, not a second public report address.
//
// **It composes nothing.** The document is `removal.tsx`'s
// `removedDocument`, which reads the same copy keys through the same one
// call site as the rendered view; the status and its two headers are that
// module's `REMOVED_RESPONSE_INIT`. This file adds the content type and
// the 404 arm and holds no policy of its own.
//
// No session, no cookie, no header about the visitor, no tier: REQ-002 c1
// requires a removed address to be readable by a visitor with no account,
// session or payment, and there is nothing here to branch on.
import {
  REMOVED_RESPONSE_INIT,
  removedDocument,
} from "@/app/(public)/scan/[domain]/_address/removal";
import { parseDomain } from "@/lib/scan/domain";
import { isDomainRemoved } from "@/lib/scan/removal";

const HTML = "text/html; charset=utf-8";

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

  const headers = new Headers(REMOVED_RESPONSE_INIT.headers);
  headers.set("Content-Type", HTML);
  return new Response(removedDocument(parsed.domain), { ...REMOVED_RESPONSE_INIT, headers });
}
