/**
 * DataForSEO Backlinks — live referring-page list per target domain.
 *
 * `one_per_domain` mode returns the single strongest backlink per referring
 * domain, ordered by rank desc, so we get the top N distinct referrers cheaply.
 * Parser is pure/defensive; fetch degrades to [] on any failure (never throws).
 */
import { env } from "@/lib/config/env";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import { normalizeHost } from "@/lib/scan/referral/classify";
import type { Referrer } from "@/lib/scan/referral/types";

const BACKLINKS_LIVE = "https://api.dataforseo.com/v3/backlinks/backlinks/live";
const DOMAIN_INTERSECTION_LIVE =
  "https://api.dataforseo.com/v3/backlinks/domain_intersection/live";

/** A referring domain that links to ≥1 of the targets, with which targets it hits. */
export interface IntersectionRow {
  referringHost: string;
  /** Indices (into the input targets array) this domain links to. */
  targetIdxs: number[];
  exampleUrl: string;
}

/**
 * Domains referring to MULTIPLE targets at once — the cross-competitor intersection
 * computed server-side. `targets` are keyed by 1-based index; the response reports,
 * per referring domain, which targets it links to. Returns [] on failure.
 *
 * Pass returnRaw to also get the raw json (for shape discovery during validation).
 */
export async function fetchDomainIntersection(
  targets: string[],
  opts: { limit?: number; returnRaw?: boolean } = {},
): Promise<{ rows: IntersectionRow[]; raw?: unknown }> {
  if (!env.dataforseoLogin || !env.dataforseoPassword || targets.length < 2) return { rows: [] };
  const targetMap: Record<string, string> = {};
  targets.forEach((t, i) => (targetMap[String(i + 1)] = t));
  try {
    const res = await fetchWithTimeout(
      DOMAIN_INTERSECTION_LIVE,
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            targets: targetMap,
            exclude_internal_backlinks: true,
            limit: opts.limit ?? 200,
            order_by: ["1.referring_domains,desc"],
          },
        ]),
      },
      25_000,
    );
    if (!res.ok) return { rows: [] };
    const json = (await res.json()) as unknown;
    return { rows: parseDomainIntersection(json, targets.length), raw: opts.returnRaw ? json : undefined };
  } catch {
    return { rows: [] };
  }
}

/**
 * Pure parser for domain_intersection. Each item is ONE referring domain; metrics
 * to each of our targets live under `item.domain_intersection["N"]` (1-based target
 * index, only present when this referrer links to target N). The referrer's own
 * host is the `target` field inside those cells. Returns 0-based target indices.
 */
export function parseDomainIntersection(body: unknown, targetCount: number): IntersectionRow[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((it) => {
    const di = it["domain_intersection"] as Record<string, unknown> | undefined;
    if (!di || typeof di !== "object") return [];
    const targetIdxs: number[] = [];
    let host = "";
    for (let i = 1; i <= targetCount; i++) {
      const cell = di[String(i)] as Record<string, unknown> | undefined;
      if (!cell) continue;
      const links = Number(cell["backlinks"] ?? cell["referring_domains"] ?? 0);
      if (links > 0) {
        targetIdxs.push(i - 1);
        if (!host && typeof cell["target"] === "string") host = cell["target"];
      }
    }
    if (!host || targetIdxs.length === 0) return [];
    return [{ referringHost: normalizeHost(host), targetIdxs, exampleUrl: `https://${normalizeHost(host)}` }];
  });
}

export function parseBacklinks(body: unknown): Referrer[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((i) => {
    const referringUrl = String(i["url_from"] ?? "");
    if (!referringUrl) return [];
    return [
      {
        referringUrl,
        referringHost: normalizeHost(referringUrl),
        targetUrl: String(i["url_to"] ?? ""),
        anchorText: String(i["anchor"] ?? ""),
      },
    ];
  });
}

/** Top backlinks for a domain (one per referring domain, strongest first). Returns [] on failure. */
export async function fetchBacklinks(domain: string, opts: { limit?: number } = {}): Promise<Referrer[]> {
  if (!env.dataforseoLogin || !env.dataforseoPassword) return [];
  try {
    const res = await fetchWithTimeout(
      BACKLINKS_LIVE,
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            target: domain,
            mode: "one_per_domain",
            limit: opts.limit ?? 200,
            order_by: ["rank,desc"],
            backlinks_status_type: "live",
          },
        ]),
      },
      20_000,
    );
    if (!res.ok) return [];
    return parseBacklinks(await res.json());
  } catch {
    return [];
  }
}
