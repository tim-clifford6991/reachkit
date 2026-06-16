/**
 * Deep domain profiling (M2) — competitor discovery (Stage 0).
 *
 * DataForSEO Labs `competitors_domain` returns domains that compete on organic
 * keywords, with an `intersections` count (shared keywords) — the cleanest
 * primitive for "closest competitors". We blocklist the subject + aggregators,
 * then rank by intersection strength. Parser + blocklist + rank are pure.
 */

import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serpAuthHeader } from "@/lib/scan/adapters/dataforseo";
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { toHost } from "./crawl";

const MODEL = "claude-haiku-4-5-20251001" as const;

/**
 * Domains that are never a product "competitor" — marketplaces, social,
 * aggregators, and the big news/reference/finance-media publishers. Keyword
 * overlap surfaces these (they out-publish everyone on informational queries),
 * but a buyer never weighs them as an alternative. The LLM filter catches the
 * long tail; this is the cheap, deterministic first pass.
 */
export const COMPETITOR_BLOCKLIST = new Set([
  // marketplaces / app stores / review aggregators
  "amazon.com", "g2.com", "capterra.com", "getapp.com", "trustpilot.com",
  "producthunt.com", "apple.com", "play.google.com", "crunchbase.com",
  "glassdoor.com", "indeed.com", "yelp.com", "alternativeto.net",
  // social / reference
  "reddit.com", "youtube.com", "wikipedia.org", "linkedin.com", "medium.com",
  "facebook.com", "twitter.com", "x.com", "instagram.com", "github.com",
  "quora.com", "pinterest.com", "tiktok.com",
  // news / business / finance media (the Forbes/Investopedia class)
  "forbes.com", "investopedia.com", "nerdwallet.com", "businessinsider.com",
  "bankrate.com", "cnbc.com", "fool.com", "wsj.com", "nytimes.com",
  "techcrunch.com", "theverge.com", "wired.com", "bloomberg.com",
  "thebalancemoney.com", "marketwatch.com", "entrepreneur.com", "inc.com",
  "hbr.org", "wikihow.com", "hubspot.com",
]);

export interface CompetitorDomain {
  domain: string;
  intersections: number;
}

/** Pure: parse Labs competitors_domain into {domain, intersections} rows. */
export function parseCompetitorsDomain(body: unknown): CompetitorDomain[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;

  const out: CompetitorDomain[] = [];
  for (const i of items ?? []) {
    const domain = String(i["domain"] ?? "").trim().toLowerCase();
    if (!domain) continue;
    const intersections = Number(i["intersections"] ?? 0);
    out.push({ domain, intersections: Number.isFinite(intersections) ? intersections : 0 });
  }
  return out;
}

/**
 * Pure: drop the subject + parent/sub-domains + aggregators, dedupe, sort by
 * intersection strength, take top-N. PURE.
 */
export function rankCompetitorDomains(
  rows: CompetitorDomain[],
  ownDomain: string,
  topN: number,
): string[] {
  const own = toHost(ownDomain);
  const ownRoot = own.split(".").slice(-2).join(".");
  const seen = new Set<string>();
  const ranked = [...rows].sort((a, b) => b.intersections - a.intersections);

  const out: string[] = [];
  for (const { domain } of ranked) {
    const host = toHost(domain);
    if (host === own) continue;
    if (host.endsWith(`.${ownRoot}`) || host === ownRoot) continue; // own sub/parent
    if (COMPETITOR_BLOCKLIST.has(host)) continue;
    if (seen.has(host)) continue;
    seen.add(host);
    out.push(host);
    if (out.length >= topN) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LLM relevance filter — keyword overlap alone surfaces media/reference sites
// (Forbes, Investopedia) that out-publish everyone but compete with no one. A
// cheap Haiku pass keeps only genuine product/service competitors.
// ---------------------------------------------------------------------------

export function buildCompetitorFilterPrompt(subjectDomain: string, domains: string[]): string {
  return `The subject company is ${subjectDomain}.

From the list below, keep ONLY genuine product or service competitors — companies
offering a similar product/service that a buyer evaluating ${subjectDomain} would
consider as an alternative.

DROP anything that merely ranks for the same topics but does not compete:
news/magazine/media sites, reference/encyclopedia sites, review/comparison/listicle
sites, blogs, marketplaces, app stores, directories, and social networks.

DOMAINS:
${domains.join("\n")}

Return ONLY this JSON (no fences): { "keep": ["domain", ...] }
— a subset of the domains above, real competitors only. If none compete, return { "keep": [] }.`;
}

/** Pure: parse the keep-list, intersecting with the input (model can't invent
 *  domains), preserving the input's ranking order. */
export function parseKeepList(raw: string, domains: string[]): string[] {
  let keep: Set<string>;
  try {
    const parsed = JSON.parse(extractJson(raw)) as { keep?: unknown };
    const list = Array.isArray(parsed.keep) ? parsed.keep : [];
    keep = new Set(list.map((d) => String(d ?? "").trim().toLowerCase()));
  } catch {
    return domains; // unparseable → don't drop everything
  }
  return domains.filter((d) => keep.has(d.toLowerCase()));
}

/**
 * Keep only genuine product competitors. Fixtures-mode (or hard error) returns
 * the input unchanged; a valid model response is trusted even if it drops most.
 */
export async function filterProductCompetitors(
  subjectDomain: string,
  domains: string[],
  opts: { scanId?: string | null } = {},
): Promise<string[]> {
  if (domains.length === 0) return [];
  if (fixturesEnabled()) return domains;
  try {
    const { text } = await callModel({
      model: MODEL,
      system: "You separate real product competitors from media/reference/marketplace sites. Return only JSON.",
      prompt: buildCompetitorFilterPrompt(subjectDomain, domains),
      scanId: opts.scanId ?? null,
      stage: "critic",
    });
    return parseKeepList(text, domains);
  } catch {
    return domains;
  }
}

/**
 * The full Stage-0: discover keyword-overlap candidates (wider net), then keep
 * only genuine product competitors via the LLM filter, then take top-N.
 */
export async function discoverProductCompetitors(
  domain: string,
  topN = 5,
  opts: { scanId?: string | null } = {},
): Promise<string[]> {
  const candidates = await discoverCompetitorDomains(domain, topN * 3);
  const filtered = await filterProductCompetitors(domain, candidates, opts);
  return filtered.slice(0, topN);
}

/**
 * Discover the top-N closest competitor domains for a domain. Fixtures-mode (or
 * failure) returns []. Never throws.
 */
export async function discoverCompetitorDomains(domain: string, topN = 5): Promise<string[]> {
  if (fixturesEnabled()) return [];
  const target = toHost(domain);
  try {
    const res = await fetchWithTimeout(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
      {
        method: "POST",
        headers: {
          Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword),
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            target,
            location_code: env.dataforseoLocationCode,
            language_code: env.dataforseoLanguageCode,
            limit: Math.max(topN * 4, 20),
            exclude_top_domains: true,
          },
        ]),
      },
      15_000,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    return rankCompetitorDomains(parseCompetitorsDomain(body), target, topN);
  } catch {
    return [];
  }
}
