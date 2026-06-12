import type { KeywordRow } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
import { serpAuthHeader } from "./dataforseo";
import { fixturesEnabled, fixtureKeywords } from "@/lib/dev/fixtures";

export function parseKeywords(body: unknown): KeywordRow[] {
  const result =
    (body as { tasks?: Array<{ result?: Array<Record<string, unknown>> }> }).tasks?.[0]?.result ?? [];
  return result.map((r) => ({
    keyword: String(r["keyword"] ?? ""),
    volume: Number(r["search_volume"] ?? 0),
    cpc: Number(r["cpc"] ?? 0),
    competition: Number(r["competition"] ?? 0),
  }));
}

export async function keywordsData(seeds: string[]): Promise<{ keywords: KeywordRow[]; raw: unknown }> {
  if (fixturesEnabled()) return fixtureKeywords(seeds);
  const res = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
        "content-type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: seeds,
          location_code: env.dataforseoLocationCode,
          language_code: env.dataforseoLanguageCode,
        },
      ]),
    },
  );
  if (!res.ok) throw new Error(`dataforseo keywords failed: ${res.status}`);
  const body = (await res.json()) as unknown;
  return { keywords: parseKeywords(body), raw: body };
}
