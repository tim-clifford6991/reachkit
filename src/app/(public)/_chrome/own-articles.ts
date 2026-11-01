// Issue 1512 — ReachKit's own published articles, read from stored rows at
// render.
//
// ReachKit is its own customer (`_how/examples.ts`): its pages are published
// on its content host like any site's. The footer links that host's index
// and the landing its newest three, so the main site links the articles it
// publishes. Every address is the one the hosted edge answers at now — the
// site's stored host and each page's slug — never a typed one.
//
// **Nothing stored, nothing linked.** A deployment with no such site, no
// live page, or a database that does not answer draws neither the footer
// link nor the landing's list. One read an hour, or after a publish or a
// takedown clears its tag, and the footer and the landing share it.
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { tags } from "@/lib/publish/destinations/hosted/cache";
import { PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import { INDEX_PATH } from "@/app/(hosted)/hosted-page/[[...slug]]/chrome";

/** How many of the newest articles the landing links. */
export const LATEST_SHOWN = 3;

export interface OwnArticles {
  /** The content host's index. */
  index: string;
  /** The newest live articles, newest first, at most `LATEST_SHOWN`. */
  latest: readonly { title: string; url: string; published: Date }[];
}

async function read(): Promise<OwnArticles | null> {
  // Imported here, not at the top: the database client checks its
  // environment when it loads, and the public pages render without one.
  const { hostedHostOfSite, hostedSiteForDomain, livePagesForSite } = await import(
    "@/lib/publish/destinations/hosted/store"
  );
  const site = await hostedSiteForDomain(PREVIEW_HOST_SUFFIX);
  if (site === null) return null;
  const host = (await hostedHostOfSite(site.siteId)) ?? site.host;
  const pages = await livePagesForSite(site.siteId, host);
  if (pages.length === 0) return null;
  // Newest by the day the article first went live: a refresh does not make
  // an old article new.
  const latest = [...pages]
    .sort((a, b) => b.firstPublishedAt.getTime() - a.firstPublishedAt.getTime())
    .slice(0, LATEST_SHOWN)
    .map((page) => ({ title: page.title, url: page.liveUrl, published: page.firstPublishedAt }));
  return { index: `https://${host}${INDEX_PATH}`, latest };
}

const cachedRead = unstable_cache(read, ["own-articles"], { revalidate: 3600, tags: [tags.ownArticles] });

async function readCached(): Promise<OwnArticles | null> {
  let held: OwnArticles | null;
  try {
    held = await cachedRead();
  } catch (error) {
    // Outside a Next request there is no data cache to hold it, so the read runs uncached.
    if (!(error instanceof Error && error.message.includes("incrementalCache missing"))) throw error;
    held = await read();
  }
  // The data cache stores JSON, so a cached date comes back a string.
  return held === null ? null : { ...held, latest: held.latest.map((entry) => ({ ...entry, published: new Date(entry.published) })) };
}

export const readOwnArticles = cache(async (): Promise<OwnArticles | null> => {
  try {
    return await readCached();
  } catch (error) {
    // The links are not the page's job: a failed read drops them, never the
    // page they sit on.
    console.error(error);
    return null;
  }
});
