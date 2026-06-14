import type { ReviewItem } from "@/lib/scan/types";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

type RssEntry = {
  "im:rating"?: { label: string };
  title?: { label: string };
  content?: { label: string };
  id?: { label: string };       // stable review id (Apple review GUID)
  updated?: { label: string };  // ISO timestamp of the review
};

export function parseRssPage(page: unknown): ReviewItem[] {
  const rawEntry = (page as { feed?: { entry?: RssEntry | RssEntry[] } }).feed?.entry;
  const entries: RssEntry[] = rawEntry == null ? [] : Array.isArray(rawEntry) ? rawEntry : [rawEntry];
  return entries.flatMap((e) => {
    const label = e["im:rating"]?.label;
    if (!label || Number.isNaN(Number(label))) return [];  // drop missing or malformed ratings
    const item: ReviewItem = { rating: Number(label), title: e.title?.label ?? "", body: e.content?.label ?? "" };
    const id = e.id?.label;
    if (id != null && id !== "") item.id = id;        // carried for watermark-scoped delta collection
    const at = e.updated?.label;
    if (at != null && at !== "") item.at = at;
    return [item];
  });
}

// ~500 recent reviews = 10 pages × ~50, fetched in parallel; failed pages degrade to empty.
export async function fetchAppReviews(appId: string, pages = 10): Promise<ReviewItem[]> {
  const urls = Array.from({ length: pages }, (_, i) =>
    `https://itunes.apple.com/us/rss/customerreviews/page=${i + 1}/id=${appId}/sortby=mostrecent/json`);
  const results = await Promise.allSettled(urls.map(async (u) => parseRssPage(await (await fetchWithTimeout(u)).json())));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
