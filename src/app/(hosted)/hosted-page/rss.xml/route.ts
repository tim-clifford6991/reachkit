// SPEC §7 (2026-09-29, issue 1141) — the hosted blog's feed, on the
// customer's own host.
//
// The middleware rewrites `/rss.xml` on a customer's host to this route like
// any other path there; the name carries a dot, which no page's address
// does, so it can never stand in front of a page. Every hosted page links
// it from its head (`[[...slug]]/seo.ts`).
//
// **The same list the index and the sitemap are** (`livePagesForSite`),
// newest first, addressed on the Host that resolved: a page cannot be in
// the feed and gone from its address. A site with no live page gets a
// valid, empty feed, as it gets an empty sitemap.
//
// **Never cached**, for the sitemap's reason: a page taken down leaves this
// document when its row changes, not after a TTL.
//
// **It names a WebSub hub** (SPEC §7, 2026-10-18, issue 1511): Google's
// public one, which each publish, update and unpublish pings
// (`publish/destinations/hosted/announce.ts`), so a subscriber hears of a
// change without polling.
//
// **It is in the site's language** (D66; issue 1514): `<language>` is the
// site's tag, the one the pages state as `inLanguage`, `og:locale` and
// `<html lang>`, never a fixed English; and its channel's title and
// description are that language's words (issue 1545). A route handler is not
// a render, so the language is handed over, not read from `readIn`.
//
// The document is the `feed` package's, not ours. It names no generator:
// nothing on a customer's host names what wrote it.
import { Feed } from "feed";
import { now } from "@/lib/config/now";
import { copyInto } from "@/lib/presentation/copy/reader";
import { hostedIdentity, livePagesForSite } from "@/lib/publish/destinations/hosted";
import { WEBSUB_HUB } from "@/lib/publish/destinations/hosted/announce";
import { resolveHost } from "../../resolve-host";
import { localeTag } from "@/lib/locale/locales";
import { siteLocale } from "@/lib/locale/site";
import { FEED_PATH, indexDescription, indexTitle } from "../[[...slug]]/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** How many pages the feed carries: the newest, which is what a reader
 *  that polls it is asking for. */
const FEED_ITEMS = 50;

export async function GET(request: Request): Promise<Response> {
  const disposition = await resolveHost(request.headers.get("host") ?? "");
  if (disposition.kind !== "site") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const [identity, pages, locale] = await Promise.all([
    hostedIdentity(disposition),
    livePagesForSite(disposition.siteId, disposition.host),
    siteLocale(disposition.siteId),
  ]);
  const business = { ...identity, domain: disposition.domain };
  const index = `https://${disposition.host}/`;

  const feed = new Feed({
    id: index,
    link: index,
    title: indexTitle(business, locale.language),
    description: indexDescription(business, locale.language),
    language: localeTag(locale),
    copyright: copyInto(locale.language, "hosted.footer", { publisher: business.name }),
    updated: pages[0]?.publishedAt ?? now(),
    generator: false,
    feedLinks: { rss: `https://${disposition.host}${FEED_PATH}` },
    hub: WEBSUB_HUB,
  });
  for (const page of pages.slice(0, FEED_ITEMS)) {
    feed.addItem({
      id: page.liveUrl,
      link: page.liveUrl,
      title: page.title,
      ...(page.description === null ? {} : { description: page.description }),
      date: page.publishedAt,
    });
  }

  return new Response(feed.rss2(), {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
