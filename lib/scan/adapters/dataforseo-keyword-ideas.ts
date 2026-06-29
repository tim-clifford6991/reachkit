/**
 * DataForSEO Labs — keyword ideas (demand mining).
 *
 * Seeded from a product's category terms, `keyword_ideas/live` returns the real
 * searches the market makes around that space — with search volume and (often)
 * intent. This is the *demand* backbone: it's review-independent (works for a
 * brand-new product with zero traction) and reveals customer problems in the
 * buyer's own words. Parser is pure/defensive; fetch is fixtures-aware.
 */
import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";

export interface KeywordIdea {
  keyword: string;
  /** Monthly search volume. */
  volume: number;
  /** main_intent: informational | navigational | commercial | transactional | null. */
  intent: string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseKeywordIdeas(body: unknown): KeywordIdea[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: KeywordIdea[] = [];
  for (const it of items) {
    const keyword = String(it["keyword"] ?? "").trim();
    if (!keyword) continue;
    const info = it["keyword_info"] as Record<string, unknown> | undefined;
    const intentInfo = it["search_intent_info"] as Record<string, unknown> | undefined;
    out.push({
      keyword,
      volume: num(info?.["search_volume"]),
      intent: intentInfo?.["main_intent"] ? String(intentInfo["main_intent"]) : null,
    });
  }
  return out;
}

/** Fetch keyword ideas seeded from category terms. [] in fixtures / on failure. */
export async function fetchKeywordIdeas(seeds: string[], limit = 200): Promise<KeywordIdea[]> {
  const keywords = seeds.map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 20);
  if (fixturesEnabled() || keywords.length === 0 || !env.dataforseoLogin) return [];
  try {
    const res = await fetchWithTimeout(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
      {
        method: "POST",
        headers: { Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword), "content-type": "application/json" },
        body: JSON.stringify([
          {
            keywords,
            location_code: env.dataforseoLocationCode,
            language_code: env.dataforseoLanguageCode,
            limit,
            order_by: ["keyword_info.search_volume,desc"],
          },
        ]),
      },
      20_000,
    );
    if (!res.ok) return [];
    return parseKeywordIdeas(await res.json());
  } catch {
    return [];
  }
}
