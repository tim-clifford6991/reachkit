// BUILD §9 — the hosted edge's two cache tags, and the one call that clears
// them.
//
// The archived plan (WO-028) states the requirement this module answers:
// "Cache invalidation on publish and on unpublish is immediate; a 410 must
// not be served from a stale cache and a takedown must not wait on a TTL."
//
// **Today the edge caches nothing, and that is the strongest form of the
// promise, not a weaker one.** `src/app/(hosted)/**` declares
// `dynamic = "force-dynamic"` and `revalidate = 0` on every surface it
// serves, so a publication row that changes is read again on the very next
// request and no TTL stands between a takedown and a 410. The tags below
// are still named, and still cleared here, because the moment any hosted
// read becomes cacheable the invalidation has to already exist at the call
// sites — a cache added later with no invalidation is exactly the shape
// that serves a removed page for a day.
//
// Next 16's `use cache` is the way a read here would be tagged, and it is a
// Cache Components feature gated on `cacheComponents` in `next.config.ts`
// — a whole-application switch, not this issue's to throw. `unstable_cache`
// would tag one read without it and is documented as "replaced by `use
// cache` in Next.js 16", so it is not used.
//
// **`{ expire: 0 }`, never the deprecated one-argument form and never
// `"max"`.** The docs: "`{ expire: 0 }`: Stale content is never served, so
// the next request is a blocking revalidate/cache miss. Use it when the
// caller needs the data gone immediately." A takedown is that caller.
import { revalidateTag } from "next/cache";

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
      // See above: outside a request scope there is no cache to clear, and
      // the edge is uncached in any case. Nothing is swallowed that a
      // caller could act on.
    }
  };
  clear(tags.site(a.siteId));
  if (a.publicationId !== undefined) clear(tags.page(a.publicationId));
}
