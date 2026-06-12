import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { useFixtures, fixturePh } from "@/lib/dev/fixtures";

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
  if (useFixtures()) return fixturePh(productName);
  const query = `query($q:String!){posts(first:8,order:VOTES,query:$q){edges{node{name votesCount url reviewsCount}}}}`;
  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.productHuntToken}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { q: productName } }),
  });
  if (!res.ok) throw new Error(`product hunt "${productName}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return { ...parsePhPosts(body, productName), raw: body };
}
