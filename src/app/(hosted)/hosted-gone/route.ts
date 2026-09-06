// BUILD §9 — the hosted address that has stopped serving: 410, never a
// redirect and never a 404.
//
// Three endings arrive here and they get one response (the archived
// WO-229): a page the customer unpublished, a customer whose access ended
// 30 days ago (REQ-076 c10), and an account that was deleted (REQ-079 c6).
// One `gone` disposition, one document, one status — the reason is carried
// on the disposition so an operator can tell which ending it was, never so
// the visitor is answered differently.
//
// **410 and not 404.** The address existed and its page is gone; 404 would
// be a claim that nothing was ever there, and it de-indexes more slowly,
// which is the opposite of what a departing customer wants. **410 and not a
// redirect**: there is nowhere to send a visitor that is not somebody
// else's page.
//
// **A Next `page.tsx` cannot set a status** — the framework offers
// `notFound`/`forbidden`/`unauthorized` and no `gone` — so the body is
// served from a route handler and `src/middleware.ts` rewrites a gone
// hosted address to it. A rewrite, never a redirect: the visitor stays at
// the address they typed and gets the right status on it. The same shape
// `src/app/api/report/[domain]/removed/route.ts` uses for #28's removed
// report, for the same framework reason.
//
// **It carries nothing of ours.** No ReachKit name, no link, no navigation,
// and no sentence — this answers on a domain that is not ours, and neither
// the operator of a stranger's domain nor its voice belongs on it. The
// document's `<title>` is HTTP's own word for HTTP's own status, which HTML
// requires an element for and a browser tab shows; the body is empty, the
// same as `(hosted)/not-found.tsx`.
//
// **Never cached.** A takedown is immediate (WO-028's NFR): `no-store`
// means no proxy between us and the visitor can keep serving the page this
// response replaced.
import { HOSTED_GONE_STATUS } from "@/lib/config/constants";

/** The status, the robots directive and the cache policy as one value, so
 *  the three cannot drift apart. */
export const HOSTED_GONE_RESPONSE_INIT: ResponseInit = Object.freeze({
  status: HOSTED_GONE_STATUS,
  headers: Object.freeze({
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex",
  }),
});

export const GONE_DOCUMENT =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="robots" content="noindex"><title>Gone</title></head>' +
  "<body></body></html>";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  return new Response(GONE_DOCUMENT, HOSTED_GONE_RESPONSE_INIT);
}
