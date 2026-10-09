// BUILD §9 — the hosted edge's two cache tags, and the one call that clears
// them.
//
// The archived plan (WO-028) states the requirement this module answers:
// "Cache invalidation on publish and on unpublish is immediate; a 410 must
// not be served from a stale cache and a takedown must not wait on a TTL."
//
// **One thing is cached: a live article** (SPEC §7, 2026-10-09, issue
// 1242), by `src/app/(hosted)/hosted-live/[host]/[slug]`. It carries the two
// tags below, so a publish and an unpublish clear it at the moment they
// happen. The promise above does not rest on that alone: `src/middleware.ts`
// decides the 410 on every request, before the cache, so a page taken down
// is not served from a cached copy even where no tag was cleared. Every
// other hosted surface — the index, the sitemap, the robots document, the
// feed, the 410 — is still rendered per request.
//
// **The tags are put on the render with `unstable_cache`.** Without Cache
// Components a render is tagged by a tagged `fetch` or by this call and by
// nothing else (`caching-without-cache-components.md`), and the page reads
// its rows through the Supabase client, not `fetch`. `use cache` and
// `cacheTag` would replace it, and they are gated on `cacheComponents` in
// `next.config.ts` — a whole-application switch, not this module's to
// throw. So `taggedForHosted` caches nothing worth the name: its value is
// `null`, and what it is called for is the tags.
//
// **`{ expire: 0 }`, never the deprecated one-argument form and never
// `"max"`.** The docs: "`{ expire: 0 }`: Stale content is never served, so
// the next request is a blocking revalidate/cache miss. Use it when the
// caller needs the data gone immediately." A takedown is that caller.
import { revalidateTag, unstable_cache } from "next/cache";

/** The two tags the hosted surface reads under. Named here rather than in
 *  `src/app/(hosted)/` because the callers are the publish and unpublish
 *  paths, which are `src/lib/` — and `src/lib/` may not import `src/app/`
 *  (ARCHITECTURE rule 6). The archived plan put them the other way round,
 *  before that fence existed. */
export const tags = Object.freeze({
  /** Everything served for one site: its pages and its sitemap. */
  site: (siteId: string): string => `hosted:site:${siteId}`,
  /** One published page. */
  page: (publicationId: string): string => `hosted:page:${publicationId}`,
});

/**
 * Puts one page's two tags on the render that awaits this, so
 * `invalidateHosted` clears that render. See this file's header for why it
 * is this call.
 */
export async function taggedForHosted(a: { siteId: string; publicationId: string }): Promise<void> {
  await unstable_cache(async () => null, ["hosted-tags", a.siteId, a.publicationId], {
    tags: [tags.site(a.siteId), tags.page(a.publicationId)],
  })();
}

/**
 * Clears everything the edge could be holding for one site, and — where the
 * change is to one page — for that page too.
 *
 * **It never throws.** `revalidateTag` is a request-scoped API and the
 * callers are a publish attempt and an unpublish, which run inside a job as
 * often as inside a request. A publish that had already delivered the page
 * must not be reported as failed because a cache that does not yet exist
 * could not be told to forget something it never held.
 */
export function invalidateHosted(a: { siteId: string; publicationId?: string }): void {
  const clear = (tag: string): void => {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // See above: outside a request scope there is no cache to reach.
      // The cached article is a minute old at most, and the middleware
      // decides a takedown before the cache, so nothing is swallowed that a
      // caller could act on.
    }
  };
  clear(tags.site(a.siteId));
  if (a.publicationId !== undefined) clear(tags.page(a.publicationId));
}
