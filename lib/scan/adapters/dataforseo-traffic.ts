/**
 * DataForSEO Labs — bulk traffic estimation, used to weight referrers by the
 * referring host's own organic traffic (ETV). A backlink on a dead page scores
 * ~0; a backlink on a high-traffic page is a real funnel. Up to 1000 hosts/call.
 */
import { env } from "@/lib/config/env";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";

const BULK_TRAFFIC =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_traffic_estimation/live";

export function parseTrafficEstimation(body: unknown): Map<string, number> {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  const out = new Map<string, number>();
  if (!Array.isArray(items)) return out;
  for (const i of items) {
    const host = String(i["target"] ?? "");
    const etv = (i["metrics"] as { organic?: { etv?: number } } | undefined)?.organic?.etv;
    if (host) out.set(host, typeof etv === "number" ? etv : 0);
  }
  return out;
}

/** Map host → estimated monthly organic traffic value. Empty map on failure. */
export async function fetchTrafficForHosts(hosts: string[]): Promise<Map<string, number>> {
  if (hosts.length === 0 || !env.dataforseoLogin || !env.dataforseoPassword) return new Map();
  try {
    const res = await fetchWithTimeout(
      BULK_TRAFFIC,
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            targets: hosts.slice(0, 1000),
            location_code: env.dataforseoLocationCode,
            language_code: env.dataforseoLanguageCode,
          },
        ]),
      },
      20_000,
    );
    if (!res.ok) return new Map();
    return parseTrafficEstimation(await res.json());
  } catch {
    return new Map();
  }
}
