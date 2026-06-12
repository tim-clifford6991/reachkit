import type { ListingFacts, Competitor } from "@/lib/scan/types";

export function appIdFromUrl(url: string): string {
  const id = url.match(/\/id(\d+)/)?.[1];
  if (!id) throw new Error(`no app id in url: ${url}`);
  return id;
}

export async function fetchItunesListing(appId: string): Promise<{
  listing: ListingFacts;
  rating: number | null;
  ratingCount: number;
  raw: unknown;
}> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${appId}&country=us`
  );
  const json = (await res.json()) as {
    results?: Array<Record<string, unknown>>;
  };
  const a = json.results?.[0] ?? {};
  return {
    listing: {
      name: String(a.trackName ?? ""),
      category: (a.primaryGenreName as string) ?? null,
      description: (a.description as string) ?? null,
    },
    rating: (a.averageUserRating as number) ?? null,
    ratingCount: Number(a.userRatingCount ?? 0),
    raw: a,
  };
}

// Competitor discovery via keyword-overlap search (Tier A, §5.2). Same store, software entity.
export async function fetchItunesCompetitors(
  term: string,
  excludeId: string
): Promise<Competitor[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=8&country=us`
  );
  const json = (await res.json()) as {
    results?: Array<Record<string, unknown>>;
  };
  return (json.results ?? [])
    .filter((r) => String(r.trackId) !== excludeId)
    .map((r, i) => ({
      name: String(r.trackName ?? ""),
      url: String(r.trackViewUrl ?? ""),
      source: "itunes_search",
      rank: i + 1,
    }));
}
