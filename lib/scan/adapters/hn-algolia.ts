import type { Community } from "@/lib/scan/types";

type HnHit = {
  title?: string;
  url?: string | null;
  points?: number;
  num_comments?: number;
  objectID?: string;
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
