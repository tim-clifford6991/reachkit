// BUILD §9 — the cached hosted article, as a static string per host and slug, so it ships no script and no flight data.
// The middleware decides a takedown, an ended access and a moved host before this cache; publish and unpublish clear it by tag.
import { articleDocument } from "../../../hosted-page/[[...slug]]/article";
import { emptyDocument } from "../../../hosted-page/[[...slug]]/gone";

export const dynamic = "force-static";
export const revalidate = 60;

/** No address is built ahead of a request; each is rendered the first time
 *  the middleware sends a reader to it. */
export function generateStaticParams(): { host: string; slug: string }[] {
  return [];
}

const HTML = { "Content-Type": "text/html; charset=utf-8" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ host: string; slug: string }> }
): Promise<Response> {
  const { host, slug } = await params;
  const html = await articleDocument(host, slug);
  // The middleware found this page live a moment ago; if it is not now, this
  // is the 404, and the next request is answered by the middleware.
  if (html === null) return new Response(await emptyDocument(host), { status: 404, headers: HTML });
  return new Response(html, { headers: HTML });
}
