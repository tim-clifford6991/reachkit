import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { useFixtures, fixtureTavily } from "@/lib/dev/fixtures";

export function parseTavily(body: unknown): Competitor[] {
  return ((body as { results?: Array<{ title: string; url: string }> }).results ?? [])
    .map((r, i) => ({ name: r.title, url: r.url, source: "tavily", rank: i + 1 }));
}

export async function tavilyAlternatives(productName: string): Promise<{ competitors: Competitor[]; raw: unknown }> {
  if (useFixtures()) return fixtureTavily(productName);
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: env.tavilyApiKey, query: `alternatives to ${productName}`, max_results: 5 }),
  });
  if (!res.ok) throw new Error(`tavily "${productName}" failed: ${res.status}`);
  const body = await res.json();
  return { competitors: parseTavily(body), raw: body };
}
