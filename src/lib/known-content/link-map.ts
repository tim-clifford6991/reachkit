// SPEC §7 (2026-10-10, issue 1391) — the site link map.
//
// Two questions about the articles ReachKit has live for a site, answered
// from their own bodies: which of the customer's pages do the articles send
// readers to, and which articles stand alone — nothing links to them, or
// they link to nothing of the site's.
//
// Pure. An article is a live page ReachKit wrote; a page of the customer's
// is any other address on their domain an article links.
import { linksOf } from "@/lib/generate/rules/text";
import { onSite, urlKey } from "@/lib/generate/links/select";

/** One live article, as it is served. */
export interface MapArticle {
  url: string;
  title: string;
  markdown: string;
}

export interface LinkMap {
  /** The customer's own pages the articles link, most-linked first. */
  receiving: readonly { url: string; articles: number }[];
  /** Articles with no link in from another article, or no link out to a
   *  page or article of the site. */
  alone: readonly { url: string; title: string; linkedFrom: number; linksOut: number }[];
  articles: number;
}

export const EMPTY_LINK_MAP: LinkMap = Object.freeze({ receiving: [], alone: [], articles: 0 });

export function linkMapOf(articles: readonly MapArticle[], domain: string): LinkMap {
  const own = new Map<string, MapArticle>();
  for (const article of articles) {
    const key = urlKey(article.url);
    if (key !== null && !own.has(key)) own.set(key, article);
  }
  const receiving = new Map<string, { url: string; articles: number }>();
  const linkedFrom = new Map<string, number>();
  const linksOut = new Map<string, number>();

  for (const [key, article] of own) {
    const out = new Set<string>();
    for (const url of linksOf(article.markdown)) {
      const target = urlKey(url);
      if (target === null || target === key || out.has(target) || !onSite(url, domain)) continue;
      out.add(target);
      if (own.has(target)) linkedFrom.set(target, (linkedFrom.get(target) ?? 0) + 1);
      else receiving.set(target, { url: receiving.get(target)?.url ?? url, articles: (receiving.get(target)?.articles ?? 0) + 1 });
    }
    linksOut.set(key, out.size);
  }

  return {
    receiving: [...receiving.values()].sort((x, y) => y.articles - x.articles || x.url.localeCompare(y.url)),
    alone: [...own]
      .map(([key, article]) => ({
        url: article.url,
        title: article.title,
        linkedFrom: linkedFrom.get(key) ?? 0,
        linksOut: linksOut.get(key) ?? 0,
      }))
      .filter((article) => article.linkedFrom === 0 || article.linksOut === 0),
    articles: own.size,
  };
}

/** The map of one site's live articles. A read that fails is an empty map. */
export async function siteLinkMap(siteId: string): Promise<LinkMap> {
  try {
    const { readOurLiveBodies, siteDomainOf } = await import("./store");
    const domain = await siteDomainOf(siteId);
    if (domain === null) return EMPTY_LINK_MAP;
    return linkMapOf(await readOurLiveBodies(siteId), domain);
  } catch {
    return EMPTY_LINK_MAP;
  }
}
