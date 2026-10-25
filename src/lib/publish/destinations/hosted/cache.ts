// BUILD §9 — the hosted edge's two cache tags, and the one call that clears them: invalidation on publish and unpublish is
// immediate, a 410 is never served from a stale cache, and a takedown never waits on a TTL.
// Only a live article is cached (SPEC §7, `src/app/(hosted)/hosted-live/[host]/[slug]`); `src/middleware.ts` decides the
// 410 before the cache, and the index, sitemap, robots, feed and 410 render per request.
// Tags go on with `unstable_cache` because the page reads through Supabase, not `fetch`, and `cacheTag` needs the
// app-wide `cacheComponents` switch; its value is `null`, it is called for the tags.
// `{ expire: 0 }`, never the deprecated one-argument form nor `"max"`: stale content is never served after a takedown.
import { revalidateTag, unstable_cache } from "next/cache";

/** The two tags the hosted surface reads under, named here because their callers are in `src/lib/`, which may not
 *  import `src/app/` (ARCHITECTURE rule 6). */
export const tags = Object.freeze({
  /** Everything served for one site: its pages and its sitemap. */
  site: (siteId: string): string => `hosted:site:${siteId}`,
  /** One published page. */
  page: (publicationId: string): string => `hosted:page:${publicationId}`,
});

/** Puts one page's two tags on the render that awaits this, so `invalidateHosted` clears it. */
export async function taggedForHosted(a: { siteId: string; publicationId: string }): Promise<void> {
  await unstable_cache(async () => null, ["hosted-tags", a.siteId, a.publicationId], {
    tags: [tags.site(a.siteId), tags.page(a.publicationId)],
  })();
}

/** Clears what the edge holds for one site, and for one page where given. Never throws: `revalidateTag` is
 *  request-scoped and callers often run in a job, where a delivered publish must not read as failed. */
export function invalidateHosted(a: { siteId: string; publicationId?: string }): void {
  const clear = (tag: string): void => {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a request there is no cache to reach, and the middleware decides a takedown before the cache.
    }
  };
  clear(tags.site(a.siteId));
  if (a.publicationId !== undefined) clear(tags.page(a.publicationId));
}
