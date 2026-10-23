// BUILD §9 — the hosted address that has stopped serving: 410, never a
// redirect and never a 404.
//
// Three endings arrive here: a page the customer unpublished, a customer
// whose access ended 30 days ago (REQ-076 c10), and an account that was
// deleted (REQ-079 c6). All three answer 410. A page removed from a site that
// is still live carries the short body of `gone.tsx` (owner R1, 2026-10-22,
// amending WO-229); a site that is gone answers with an empty document.
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
// **It carries nothing of ours.** No ReachKit name, link or sentence: this
// answers on a domain that is not ours. The empty document's `<title>` is
// HTTP's own word for its status, and its `lang` is the site's stored one.
//
// **Never cached.** A takedown is immediate (WO-028's NFR): `no-store`
// means no proxy between us and the visitor can keep serving the page this
// response replaced.
import { HOSTED_GONE_STATUS } from "@/lib/config/constants";
import { localeTag } from "@/lib/locale/locales";
import { readStoredLocale } from "@/lib/locale/site";
import { readingIn } from "@/lib/presentation/copy/reader";
import { resolveHost } from "../resolve-host";
import { businessOf } from "../hosted-page/[[...slug]]/article";
import { goneDocument } from "../hosted-page/[[...slug]]/gone";

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

/** The empty document of a site that is gone, in its stored language where
 *  one can be read. */
export function emptyGoneDocument(lang: string | null = null): string {
  return (
    `<!doctype html><html${lang === null ? "" : ` lang="${lang}"`}><head><meta charset="utf-8">` +
    '<meta name="robots" content="noindex"><title>Gone</title></head>' +
    "<body></body></html>"
  );
}

export const GONE_DOCUMENT = emptyGoneDocument();

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function storedLang(siteId: string | undefined): Promise<string | null> {
  if (siteId === undefined) return null;
  const locale = await readStoredLocale(siteId).catch(() => null);
  return locale === null ? null : localeTag(locale);
}

export async function GET(request?: Request): Promise<Response> {
  const host = request?.headers.get("host") ?? "";
  const disposition = host === "" ? null : await resolveHost(host).catch(() => null);
  // A live site lost one page: say so in its own voice. Anything else is a
  // site that is gone, and that answers with nothing of the customer's.
  if (disposition?.kind === "site") {
    const body = await readingIn(async () => goneDocument(await businessOf(disposition), host));
    return new Response(body, HOSTED_GONE_RESPONSE_INIT);
  }
  const lang = disposition?.kind === "gone" ? await storedLang(disposition.siteId) : null;
  return new Response(emptyGoneDocument(lang), HOSTED_GONE_RESPONSE_INIT);
}
