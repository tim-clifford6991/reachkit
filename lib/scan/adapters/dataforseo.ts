import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { fixturesEnabled, fixtureSerp } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { recordDataForSeoCost } from "@/lib/scan/cost-context";

export function serpAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

/**
 * Parse a DataForSEO JSON response AND record its real USD cost against the
 * active scan. Every v3 endpoint returns `cost` at the envelope top level, so
 * this is the single choke point through which all DataForSEO reads should pass
 * — call it in place of `res.json()`. Cost is a no-op outside a scan context.
 */
export async function dfsJson(res: Response): Promise<unknown> {
  const body = (await res.json()) as unknown;
  recordDataForSeoCost(body);
  return body;
}

export function parseSerp(body: unknown): { competitors: Competitor[]; serpResultCount: number } {
  const result = (body as { tasks?: Array<{ result?: Array<{ se_results_count?: number; items?: Array<Record<string, unknown>> }> }> })
    .tasks?.[0]?.result?.[0];
  const organic = (result?.items ?? []).filter((i) => i["type"] === "organic");
  const competitors = organic
    .map((i, idx) => ({ name: String(i["title"] ?? i["domain"] ?? ""), url: String(i["url"] ?? ""), source: "dataforseo_serp", rank: idx + 1 }));
  return { competitors, serpResultCount: Number(result?.se_results_count ?? 0) };
}

/**
 * Flatten organic results' title + description into one text block for LLM
 * competitor-name extraction. The real competitor names ("Fin, Drift, Zendesk")
 * live in the snippet/description, not in result titles/URLs (which are listicles).
 */
export function parseSerpContent(body: unknown): string {
  const result = ((body ?? {}) as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> })
    .tasks?.[0]?.result?.[0];
  return (result?.items ?? [])
    .filter((i) => i["type"] === "organic")
    .map((i) => `${String(i["title"] ?? "")} — ${String(i["description"] ?? "")}`.trim())
    .filter((s) => s.length > 2)
    .join("\n");
}

// Live SERP — used only for the 10s screen (Live is the costed exception; Standard queue is the default elsewhere).
export async function liveSerpAlternatives(productName: string): Promise<{ competitors: Competitor[]; serpResultCount: number; raw: unknown }> {
  if (fixturesEnabled()) return fixtureSerp(productName);
  const res = await fetchWithTimeout("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword), "content-type": "application/json" },
    body: JSON.stringify([{ keyword: `alternatives to ${productName}`, location_code: env.dataforseoLocationCode, language_code: env.dataforseoLanguageCode, depth: 10 }]),
    // 10s (was 15s): SERP Live is the slowest external in the free scan's collect
    // step and gates its critical path. Degradation is graceful — findCompetitors
    // runs allSettled across SERP/PH/Tavily, and the web-mode content refine
    // recovers competitor names from the Tavily doc when the SERP doc is absent.
  }, 10_000);
  if (!res.ok) throw new Error(`dataforseo serp "${productName}" failed: ${res.status}`);
  const body = await dfsJson(res);
  return { ...parseSerp(body), raw: body };
}
