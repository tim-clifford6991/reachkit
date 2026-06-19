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
  const b = (body ?? {}) as { answer?: string; results?: Array<{ title?: string; content?: string }> };
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

// ---------------------------------------------------------------------------
// General-purpose Tavily — beyond competitor discovery (ChannelIntel Phase 3)
// ---------------------------------------------------------------------------

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  /** Publish date (ISO) when present — used for freshness/news. */
  publishedDate: string | null;
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  topic?: "general" | "news";
  /** e.g. "week" | "month" | "year" (news freshness window). */
  timeRange?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
}

/** Pure: parse a Tavily /search body into typed results. */
export function parseTavilyResults(body: unknown): TavilyResult[] {
  const results = (body as { results?: Array<Record<string, unknown>> })?.results ?? [];
  return results.map((r) => ({
    title: String(r["title"] ?? ""),
    url: String(r["url"] ?? ""),
    content: String(r["content"] ?? ""),
    publishedDate: typeof r["published_date"] === "string" ? r["published_date"] : null,
  }));
}

/**
 * General Tavily search with the full option set (advanced depth, news topic,
 * time range, domain include/exclude). Returns [] in fixtures mode and degrades
 * to [] on any failure (best-effort enrichment, never a hard dependency).
 */
export async function tavilySearch(query: string, opts: TavilySearchOptions = {}): Promise<TavilyResult[]> {
  if (fixturesEnabled()) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: env.tavilyApiKey,
        query,
        max_results: opts.maxResults ?? 8,
        search_depth: opts.searchDepth ?? "basic",
        ...(opts.topic ? { topic: opts.topic } : {}),
        ...(opts.timeRange ? { time_range: opts.timeRange } : {}),
        ...(opts.includeDomains ? { include_domains: opts.includeDomains } : {}),
        ...(opts.excludeDomains ? { exclude_domains: opts.excludeDomains } : {}),
      }),
    });
    if (!res.ok) return [];
    return parseTavilyResults(await res.json());
  } catch {
    return [];
  }
}

/** Pure: parse a Tavily /extract body into {url, content} rows. */
export function parseTavilyExtract(body: unknown): Array<{ url: string; content: string }> {
  const results = (body as { results?: Array<Record<string, unknown>> })?.results ?? [];
  return results
    .map((r) => ({ url: String(r["url"] ?? ""), content: String(r["raw_content"] ?? r["content"] ?? "") }))
    .filter((r) => r.url.length > 0);
}

/** Extract clean full-page content for a set of URLs. [] in fixtures / on failure. */
export async function tavilyExtract(urls: string[]): Promise<Array<{ url: string; content: string }>> {
  if (fixturesEnabled() || urls.length === 0) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: env.tavilyApiKey, urls }),
    });
    if (!res.ok) return [];
    return parseTavilyExtract(await res.json());
  } catch {
    return [];
  }
}
