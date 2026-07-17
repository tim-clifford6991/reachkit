/**
 * DataForSEO Labs — domain_rank_overview (free-scan honest totals).
 *
 * `domain_rank_overview/live` → a domain's TRUE organic footprint: total keyword
 * count and total estimated traffic value, NOT a top-N sample. One call, ~1.2¢
 * (verified live 2026-07-17). This is what replaces the free report's two
 * long-standing lies: `keywordsRanked` capped at the API's `limit` (50, rendered
 * as if it were the real count — resend.com truly ranks for 2,100) and
 * `estMonthlyVisits` summed over only the top-50 rows (a floor labelled as a total).
 *
 * SHAPE NOTE (the plan's assumed path was wrong — verified live): the metrics live
 * at `result[0].items[0].metrics.organic`, NOT `result[0].metrics.organic`.
 *
 * Pure/defensive parser (unknown shape → null, never throws); fetch is
 * fixtures-aware (null so dev/test stays keyless). US/en, matching the rest.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader, dfsJson } from "@/lib/scan/adapters/dataforseo";

export interface DomainOverview {
  /** TRUE total number of organic keywords the domain ranks for (not a sample). */
  organicKeywords: number;
  /** TRUE total estimated monthly organic traffic value (Σ over ALL keywords). */
  organicEtv: number;
  /** Keywords in position 1 — a real "you dominate N terms" signal. */
  pos1: number;
  /** Keywords in positions 2–3 (also "winning"). */
  pos2_3: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Pure: parse a domain_rank_overview body into the true organic totals, or null
 * when the shape is unrecognised / empty. Reads the VERIFIED path
 * `tasks[0].result[0].items[0].metrics.organic`.
 */
export function parseDomainOverview(body: unknown): DomainOverview | null {
  const tasks = (body as { tasks?: unknown[] } | null)?.tasks;
  const result = (tasks?.[0] as { result?: unknown[] } | undefined)?.result;
  const items = (result?.[0] as { items?: unknown[] } | undefined)?.items;
  const organic = (items?.[0] as { metrics?: { organic?: Record<string, unknown> } } | undefined)?.metrics?.organic;
  if (!organic || typeof organic !== "object") return null;
  // A domain with a genuine footprint always has count > 0 here; treat a missing
  // count as "no usable data" (null) so the caller degrades to the sample rather
  // than rendering a false 0.
  if (organic["count"] == null) return null;
  return {
    organicKeywords: num(organic["count"]),
    organicEtv: num(organic["etv"]),
    pos1: num(organic["pos_1"]),
    pos2_3: num(organic["pos_2_3"]),
  };
}

/** Fetch a domain's true organic footprint. null in fixtures / on any failure. */
export async function fetchDomainOverview(target: string): Promise<DomainOverview | null> {
  if (fixturesEnabled()) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live",
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          { target, location_code: env.dataforseoLocationCode, language_code: env.dataforseoLanguageCode },
        ]),
      },
      15_000,
    );
    if (!res.ok) return null;
    return parseDomainOverview(await dfsJson(res));
  } catch {
    return null;
  }
}
