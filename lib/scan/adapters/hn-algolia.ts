import type { Community, TimedCommunity } from "@/lib/scan/types";

type HnHit = {
  title?: string;
  url?: string | null;
  points?: number;
  num_comments?: number;
  objectID?: string;
  created_at?: string;     // ISO timestamp
  created_at_i?: number;   // unix seconds
};

type HnBody = { hits?: HnHit[] };

export function parseHnAlgolia(body: unknown): Community[] {
  const hits = ((body as HnBody).hits ?? []);
  return hits.map((hit) => {
    const url =
      hit.url != null && hit.url !== ""
        ? hit.url
        : `https://news.ycombinator.com/item?id=${hit.objectID ?? ""}`;
    return {
      source: "hn",
      title: hit.title ?? "",
      url,
      engagement: (hit.points ?? 0) + (hit.num_comments ?? 0),
    };
  });
}

export async function hnSearch(query: string): Promise<Community[]> {
  const enc = encodeURIComponent(query);
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${enc}&tags=story`,
  );
  if (!res.ok) throw new Error(`hn-algolia "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseHnAlgolia(body);
}

// Timestamp-carrying variant for the threads delta collector. Drops hits with no
// resolvable timestamp (can't be watermark-compared). Prefers created_at, falls
// back to created_at_i (unix seconds → ISO).
export function parseHnAlgoliaTimed(body: unknown): TimedCommunity[] {
  const hits = ((body as HnBody).hits ?? []);
  return parseHnAlgolia(body).flatMap((community, i) => {
    const hit = hits[i];
    const iso = hit?.created_at ?? (hit?.created_at_i != null ? new Date(hit.created_at_i * 1000).toISOString() : undefined);
    if (iso == null || iso === "") return [];
    return [{ ...community, at: iso }];
  });
}

export async function hnSearchTimed(query: string): Promise<TimedCommunity[]> {
  const enc = encodeURIComponent(query);
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query=${enc}&tags=story`,
  );
  if (!res.ok) throw new Error(`hn-algolia "${query}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return parseHnAlgoliaTimed(body);
}
