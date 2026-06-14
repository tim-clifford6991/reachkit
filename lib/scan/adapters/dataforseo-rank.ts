import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import { fixtureRankMap } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

/**
 * Keyword → SERP position lookup for a single target (domain/app).
 *
 * Cheap-by-construction input to the rank delta collector (Cycle 4 Task 8) and,
 * later, the `track_rank` tool (Task 13) which wraps this.
 *
 * Contract: NEVER throws. Any failure (missing keys, HTTP error, malformed body,
 * a keyword the target doesn't rank for) degrades to that keyword being absent
 * from the returned map. A total failure returns {}.
 *
 * Fixtures mode: returns a DETERMINISTIC canned map (stable position derived from
 * each keyword string) so the whole weekly refresh runs keyless.
 */
export async function rankLookup(keywords: string[], target: string): Promise<Record<string, number>> {
  const unique = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 0))];
  if (unique.length === 0) return {};

  if (fixturesEnabled()) return fixtureRankMap(unique, target);

  // Live path: one DataForSEO SERP task per keyword; find where `target` ranks.
  // Live endpoint (the costed exception) mirrors lib/scan/adapters/dataforseo.ts.
  const host = normalizeTarget(target);
  const entries = await Promise.allSettled(
    unique.map(async (keyword) => [keyword, await rankOne(keyword, host)] as const),
  );

  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.status === "fulfilled") {
      const [keyword, position] = e.value;
      if (position != null) out[keyword] = position;
    }
  }
  return out;
}

// Returns the 1-based organic position of `host` for `keyword`, or null if it
// doesn't appear in the fetched depth / on any error.
async function rankOne(keyword: string, host: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
      method: "POST",
      headers: {
        Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
        "content-type": "application/json",
      },
      body: JSON.stringify([{
        keyword,
        location_code: env.dataforseoLocationCode,
        language_code: env.dataforseoLanguageCode,
        depth: 50,
      }]),
    }, 15_000);
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return findPosition(body, host);
  } catch {
    return null;  // degrade — never throw
  }
}

export function findPosition(body: unknown, host: string): number | null {
  if (body == null || typeof body !== "object") return null;
  const items = (body as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items ?? [];

  let rank = 0;
  for (const item of items) {
    if (item["type"] !== "organic") continue;
    rank += 1;
    const itemHost = normalizeTarget(String(item["domain"] ?? item["url"] ?? ""));
    if (itemHost !== "" && (itemHost === host || itemHost.endsWith(`.${host}`) || host.endsWith(`.${itemHost}`))) {
      return rank;
    }
  }
  return null;
}

// Lowercase bare host: strips scheme, path, leading www. Tolerant of bare domains.
export function normalizeTarget(target: string): string {
  let t = target.trim().toLowerCase();
  if (t === "") return "";
  t = t.replace(/^[a-z]+:\/\//, "");
  const slash = t.indexOf("/");
  if (slash !== -1) t = t.slice(0, slash);
  t = t.replace(/^www\./, "");
  return t;
}
