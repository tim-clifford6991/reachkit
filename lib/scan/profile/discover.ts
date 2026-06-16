/**
 * Deep domain profiling (M2) — category/market-first competitor discovery.
 *
 * Keyword-overlap (`competitors_domain`) only works when the SUBJECT already has
 * a big SEO footprint — which our ICP (indie founders) does not. So discovery is
 * driven by what the product DOES, not what it ranks for:
 *
 *   1. PROPOSE — an LLM proposes direct competitors in the product's category
 *      (it knows most landscapes), given the crawled name + description.
 *   2. VERIFY  — each proposal must be corroborated by a market signal
 *      ("alternatives to {name}" SERP, or keyword overlap) OR resolve to a live
 *      domain. The LLM never gets to invent an unverifiable competitor.
 *   3. FILTER  — the same-category LLM filter drops adjacent/media sites.
 *   4. RANK    — by corroboration (how many independent signals name it).
 *
 * Pure helpers are exported for tests; network/LLM calls are fixtures-aware.
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { liveSerpAlternatives } from "@/lib/scan/adapters/dataforseo";
import { toHost } from "./crawl";
import {
  COMPETITOR_BLOCKLIST,
  discoverCompetitorDomains,
  filterProductCompetitors,
} from "./competitors";

// The PROPOSE step leans on world knowledge of competitive landscapes (esp.
// niche ones), so it uses Sonnet — Haiku is too weak here. Verification + the
// category filter keep it honest.
const PROPOSE_MODEL = "claude-sonnet-4-6" as const;
const MAX_LLM_VERIFY = 8;

const DEBUG = process.env.PROFILE_DEBUG === "1";
function debug(...args: unknown[]): void {
  if (DEBUG) console.log("[discover]", ...args);
}

export interface ProductInfo {
  name: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Registrable host from a URL/domain, or null. */
export function domainFromUrl(url: string): string | null {
  if (!url) return null;
  const host = toHost(url);
  return host.includes(".") ? host : null;
}

export function buildProposePrompt(product: ProductInfo, count: number): string {
  const ctx = product.description ? `${product.name} — ${product.description}` : product.name;
  return `You know the competitive landscape of most product categories.

SUBJECT:
${ctx}

List up to ${count} DIRECT competitors — companies offering a similar product or
service in the SAME category that a buyer of "${product.name}" would directly
choose between. Prefer focused/comparable products over broad enterprise giants.

For each, give its primary website domain if you are confident of it (else omit
the domain). Do NOT invent domains.

Return ONLY this JSON (no fences):
{ "competitors": [ { "name": "...", "domain": "example.com" } ] }

Rules:
- Same category and substitutable only — NOT marketplaces, media/reference sites,
  or adjacent-but-different-category giants.
- Never include "${product.name}" itself.
- If you don't know real competitors, return { "competitors": [] }.`;
}

/** Parse proposed competitors → normalized {name, domain|null}. PURE. */
export function parseProposed(raw: string): Array<{ name: string; domain: string | null }> {
  let list: unknown[];
  try {
    const parsed = JSON.parse(extractJson(raw)) as { competitors?: unknown };
    list = Array.isArray(parsed.competitors) ? parsed.competitors : [];
  } catch {
    return [];
  }
  const out: Array<{ name: string; domain: string | null }> = [];
  for (const c of list) {
    const o = c as { name?: unknown; domain?: unknown };
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    const domain = o.domain ? domainFromUrl(String(o.domain)) : null;
    out.push({ name, domain });
  }
  return out;
}

/** Drop the subject + its sub/parent domains + aggregators. PURE. */
export function isDisqualified(host: string, ownHost: string): boolean {
  const ownRoot = ownHost.split(".").slice(-2).join(".");
  if (host === ownHost) return true;
  if (host === ownRoot || host.endsWith(`.${ownRoot}`)) return true;
  return COMPETITOR_BLOCKLIST.has(host);
}

/**
 * Rank corroborated domains: more independent signals first. `sources` maps a
 * host → the set of signals that named it ("alternatives" | "overlap" | "llm").
 * PURE.
 */
export function rankByCorroboration(
  domains: string[],
  sources: Map<string, Set<string>>,
): string[] {
  return [...domains].sort((a, b) => (sources.get(b)?.size ?? 0) - (sources.get(a)?.size ?? 0));
}

// ---------------------------------------------------------------------------
// Network / LLM (fixtures-aware)
// ---------------------------------------------------------------------------

/** LLM-proposed competitors for a product (the "propose" step). */
export async function proposeCompetitors(
  product: ProductInfo,
  opts: { count?: number; scanId?: string | null } = {},
): Promise<Array<{ name: string; domain: string | null }>> {
  if (fixturesEnabled()) return [];
  try {
    const { text } = await callModel({
      model: PROPOSE_MODEL,
      system: "You name direct, same-category product competitors and their domains. Return only JSON.",
      prompt: buildProposePrompt(product, opts.count ?? 8),
      scanId: opts.scanId ?? null,
      stage: "synth",
    });
    return parseProposed(text);
  } catch {
    return [];
  }
}

/** Domains from an "alternatives to {name}" SERP (a market signal). */
export async function alternativesDomains(name: string): Promise<string[]> {
  if (fixturesEnabled()) return [];
  try {
    const { competitors } = await liveSerpAlternatives(name);
    return competitors
      .map((c) => (c.url ? domainFromUrl(c.url) : null))
      .filter((d): d is string => !!d);
  } catch {
    return [];
  }
}

/** Whether a domain resolves to a live site (the "verify" step). Fixtures → true. */
export async function resolveDomainLive(host: string): Promise<boolean> {
  if (fixturesEnabled()) return true;
  try {
    const res = await fetchWithTimeout(
      `https://${host}/`,
      { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)" } },
      6000,
    );
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Category/market-first discovery → top-N competitor domains.
 *
 * Propose (LLM) + market signals (alternatives-to SERP, keyword overlap) →
 * verify LLM-only proposals resolve live → same-category filter → rank by
 * corroboration. Works at any footprint, including zero.
 */
export async function discoverCompetitorsSmart(
  domain: string,
  product: ProductInfo,
  opts: { topN?: number; scanId?: string | null } = {},
): Promise<string[]> {
  const topN = opts.topN ?? 5;
  const ownHost = toHost(domain);

  const [proposed, altDomains, overlapDomains] = await Promise.all([
    proposeCompetitors(product, { scanId: opts.scanId }),
    alternativesDomains(product.name),
    discoverCompetitorDomains(domain, topN * 3),
  ]);

  debug(`subject: ${product.name} — ${product.description ?? "(no description)"}`);
  debug("LLM proposed:", proposed.map((p) => `${p.name}${p.domain ? ` (${p.domain})` : " (no domain)"}`));
  debug("alternatives-to SERP:", altDomains);
  debug("keyword-overlap:", overlapDomains);

  // Tag every candidate host with the signals that named it.
  const sources = new Map<string, Set<string>>();
  const tag = (raw: string, src: string) => {
    const host = toHost(raw);
    if (!host.includes(".") || isDisqualified(host, ownHost)) return;
    (sources.get(host) ?? sources.set(host, new Set()).get(host)!).add(src);
  };
  for (const d of altDomains) tag(d, "alternatives");
  for (const d of overlapDomains) tag(d, "overlap");
  for (const p of proposed) if (p.domain) tag(p.domain, "llm");

  // Verify: a candidate counts if corroborated by a market signal (in the wild),
  // or — if LLM-only — it must resolve to a live domain (bounded).
  const corroborated: string[] = [];
  const llmOnly: string[] = [];
  for (const [host, srcs] of sources) {
    if (srcs.size > 1 || !srcs.has("llm")) corroborated.push(host);
    else llmOnly.push(host);
  }
  const verifiedLlm = (
    await Promise.all(
      llmOnly.slice(0, MAX_LLM_VERIFY).map(async (h) => ((await resolveDomainLive(h)) ? h : null)),
    )
  ).filter((h): h is string => !!h);

  const candidates = [...corroborated, ...verifiedLlm];
  debug("corroborated:", corroborated, "| llm-only verified:", verifiedLlm);
  if (candidates.length === 0) return [];

  // Same-category filter (drops adjacent/media), then rank by corroboration.
  const filtered = await filterProductCompetitors({ domain, description: product.description }, candidates, {
    scanId: opts.scanId,
  });
  debug("after category filter:", filtered);
  return rankByCorroboration(filtered, sources).slice(0, topN);
}
