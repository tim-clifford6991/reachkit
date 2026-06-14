import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { fixturesEnabled, fixtureTavily } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export function parseTavily(body: unknown): Competitor[] {
  return ((body as { results?: Array<{ title: string; url: string }> }).results ?? [])
    .map((r, i) => ({ name: r.title, url: r.url, source: "tavily", rank: i + 1 }));
}

/**
 * Synthesized answer + per-result content, for LLM competitor-name extraction.
 * The answer/snippets name real competitors that the result titles/URLs do not.
 */
export function parseTavilyContent(body: unknown): string {
  const b = body as { answer?: string; results?: Array<{ title?: string; content?: string }> };
  const parts: string[] = [];
  if (b.answer) parts.push(b.answer);
  for (const r of b.results ?? []) parts.push(`${r.title ?? ""} — ${r.content ?? ""}`.trim());
  return parts.filter((s) => s.length > 2).join("\n");
}

export async function tavilyAlternatives(productName: string): Promise<{ competitors: Competitor[]; raw: unknown }> {
  if (fixturesEnabled()) return fixtureTavily(productName);
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: env.tavilyApiKey, query: `alternatives to ${productName}`, max_results: 5, include_answer: true }),
  });
  if (!res.ok) throw new Error(`tavily "${productName}" failed: ${res.status}`);
  const body = await res.json();
  return { competitors: parseTavily(body), raw: body };
}
