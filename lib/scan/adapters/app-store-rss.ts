import type { ReviewItem } from "@/lib/scan/types";

type RssEntry = { "im:rating"?: { label: string }; title?: { label: string }; content?: { label: string } };

export function parseRssPage(page: unknown): ReviewItem[] {
  const rawEntry = (page as { feed?: { entry?: RssEntry | RssEntry[] } }).feed?.entry;
  const entries: RssEntry[] = rawEntry == null ? [] : Array.isArray(rawEntry) ? rawEntry : [rawEntry];
  return entries.flatMap((e) => {
    const label = e["im:rating"]?.label;
    if (!label || Number.isNaN(Number(label))) return [];  // drop missing or malformed ratings
    return [{ rating: Number(label), title: e.title?.label ?? "", body: e.content?.label ?? "" }];
  });
}

// ~500 recent reviews = 10 pages × ~50, fetched in parallel; failed pages degrade to empty.
export async function fetchAppReviews(appId: string, pages = 10): Promise<ReviewItem[]> {
  const urls = Array.from({ length: pages }, (_, i) =>
    `https://itunes.apple.com/us/rss/customerreviews/page=${i + 1}/id=${appId}/sortby=mostrecent/json`);
  const results = await Promise.allSettled(urls.map(async (u) => parseRssPage(await (await fetch(u)).json())));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
