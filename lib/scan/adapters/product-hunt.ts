import type { Competitor } from "@/lib/scan/types";
import { fixturesEnabled, fixturePh } from "@/lib/dev/fixtures";

type PhNode = { name: string; votesCount: number; url: string; reviewsCount: number };

export function parsePhPosts(data: unknown, productName: string): { selfUpvotes: number; neighbours: Competitor[] } {
  const edges = ((data as { data?: { posts?: { edges?: Array<{ node: PhNode }> } } }).data?.posts?.edges ?? []).map((e) => e.node);
  const self = edges.find((n) => n.name.toLowerCase() === productName.toLowerCase());
  const neighbours = edges
    .filter((n) => n.name.toLowerCase() !== productName.toLowerCase())
    .map((n, i) => ({ name: n.name, url: n.url, source: "product_hunt", rank: i + 1 }));
  return { selfUpvotes: self?.votesCount ?? 0, neighbours };
}

export async function fetchPhByName(productName: string): Promise<{ selfUpvotes: number; neighbours: Competitor[]; raw: unknown }> {
  if (fixturesEnabled()) return fixturePh(productName);
  // Product Hunt API v2's `posts` field has NO reliable free-text search — the
  // old `query` argument made the API error outright ("Field 'posts' doesn't
  // accept argument 'query'"). More importantly, looking a product up by name
  // would risk matching a same-named DIFFERENT product (brand-ambiguity hard
  // rule). Until a domain-anchored PH lookup exists (v1.5), return a best-effort
  // EMPTY signal rather than guessing: never fabricate "neighbours" from
  // unrelated top posts, and let PH upvotes simply not contribute to the web
  // proxy. parsePhPosts is retained for that future domain-anchored path.
  return { selfUpvotes: 0, neighbours: [], raw: { skipped: "ph_v2_no_text_search" } };
}
