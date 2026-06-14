import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { fixturesEnabled, fixtureSerp } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export function serpAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
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
  const result = (body as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> })
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
  }, 15_000);
  if (!res.ok) throw new Error(`dataforseo serp "${productName}" failed: ${res.status}`);
  const body = await res.json() as unknown;
  return { ...parseSerp(body), raw: body };
}
