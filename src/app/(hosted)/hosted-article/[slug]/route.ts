// BUILD §9 — an article address the middleware did not find live: drawn per request by the cached article's own renderer.
// That covers a page whose read missed its deadline and an address that never held a page, which answers the hosted 404.
import { readingIn } from "@/lib/presentation/copy/reader";
import { resolveHost } from "../../resolve-host";
import { articleDocument, businessOf } from "../../hosted-page/[[...slug]]/article";
import { emptyDocument, goneDocument } from "../../hosted-page/[[...slug]]/gone";

export const dynamic = "force-dynamic";

const UNCACHED = { "Cache-Control": "no-store", "Content-Type": "text/html; charset=utf-8" };

/** The hosted 404 as `not-found.tsx` draws it: a live site's own short note, else nothing (WO-028). */
async function notFoundDocument(host: string): Promise<string> {
  const disposition = await resolveHost(host).catch(() => null);
  if (disposition?.kind !== "site") return emptyDocument(host);
  return readingIn(async () => goneDocument(await businessOf(disposition), host));
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const host = request.headers.get("host") ?? "";
  const html = await articleDocument(host, slug);
  if (html === null) return new Response(await notFoundDocument(host), { status: 404, headers: UNCACHED });
  return new Response(html, { headers: UNCACHED });
}
