/**
 * Content effectiveness gatherer (Item 3 — supply-demand-synthesis plan §2.6).
 *
 * For a subject + competitors, fetches each domain's top organic pages (from
 * the cached DataForSEO relevant_pages adapter), classifies each page into a
 * fixed content-type vocabulary, clusters all pages into a SHARED topic taxonomy
 * (so "who covers which topic" is comparable across entities), and does a
 * best-effort word-count fetch on the highest-ETV page per entity.
 *
 * Everything is cached globally (content-intel:<self>:<cohortKey>, 7d) so
 * repeat dashboard loads are instant and burn zero new API/LLM credit.
 */

import { parse } from "node-html-parser";
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cachedRelevantPages, cohortFor } from "@/lib/scan/cache/cached-adapters";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { serverDb } from "@/lib/db/client";
import type { ContentIntel, ContentEntity, ContentPage, Cluster, ContentType } from "./types";
import type { OnStageCallback } from "@/lib/scan/types";

export type { ContentIntel, ContentEntity, ContentPage, Cluster, ContentType };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_TYPES: ContentType[] = [
  "guide", "comparison", "listicle", "landing", "tool", "blog", "docs", "other",
];

const PAGES_PER_ENTITY = 15;

// ---------------------------------------------------------------------------
// Content-type classification — URL heuristic + LLM refinement
// ---------------------------------------------------------------------------

/**
 * Fast URL-path heuristic that covers the most common content types without
 * an LLM call. Returns null when the URL gives insufficient signal so the
 * LLM can handle the uncertain cases.
 *
 * Exported for unit testing.
 */
export function inferTypeFromUrl(rawUrl: string): ContentType | null {
  const u = rawUrl.toLowerCase();
  let path = u;
  try { path = new URL(u).pathname; } catch { /* use raw string */ }

  // Docs / help / support (incl. Zendesk /hc/ and support.* subdomains)
  if (/\/docs?\/|\/help\/|\/support\/|\/kb\/|\/hc\/|\/knowledge[-_]base\//.test(path)) return "docs";

  // Blog sub-paths — inspect the slug for more specific types
  if (/\/blog\/|\/articles?\/|\/resources?\/|\/posts?\//.test(path)) {
    if (/[/-](vs|versus)[/-]|alternatives?|compare|comparison/.test(path)) return "comparison";
    if (/[/-](top|best)[/-]\d|[/-]\d+[/-](best|top)|listicle/.test(path)) return "listicle";
    if (/\/guide\/|[/-]guide|how-to|tutorial|step-by-step/.test(path)) return "guide";
    return "blog";
  }

  // Tools
  if (/\/tools?\/|\/generator|\/calculator|\/checker|\/free-/.test(path)) return "tool";

  // Comparison / VS slugs outside blog paths
  if (/[/-](vs|versus)[/-]|[/-]alternatives?[/-]|compare/.test(path)) return "comparison";
  // Listicle slugs outside blog paths
  if (/[/-](top|best)[/-]\d|[/-]\d+[/-](best|top)/.test(path)) return "listicle";

  // Landing: homepage or very shallow product path
  try {
    const clean = new URL(u).pathname.replace(/\/$/, "");
    const depth = clean.split("/").filter(Boolean).length;
    if (depth === 0) return "landing"; // root "/"
    if (depth === 1 && !/\/blog|\/article|\/guide|\/docs|\/help|\/tool/.test(clean)) return "landing";
  } catch { /* ignore */ }

  return null; // uncertain — send to LLM
}

/** Parse and validate a raw JSON string from the model into typed classifications. */
export function parseContentTypeClassifications(
  raw: string,
  urls: string[],
): Array<{ url: string; type: ContentType }> {
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (!Array.isArray(parsed)) return urls.map((url) => ({ url, type: "other" }));

    // Build a map from url → type so the returned array preserves input order.
    const byUrl = new Map<string, ContentType>();
    for (const item of parsed) {
      const o = item as Record<string, unknown>;
      const url = String(o.url ?? o.URL ?? "").trim();
      const type = String(o.type ?? o.content_type ?? "").toLowerCase().trim();
      if (url && CONTENT_TYPES.includes(type as ContentType)) {
        byUrl.set(url, type as ContentType);
      }
    }
    return urls.map((url) => ({ url, type: byUrl.get(url) ?? "other" }));
  } catch {
    return urls.map((url) => ({ url, type: "other" }));
  }
}

/**
 * Classify a batch of URLs into content types.
 *
 * Strategy:
 *   1. Apply `inferTypeFromUrl` heuristic — handles ~80 % of cases for free.
 *   2. LLM (Haiku) only for URLs where the heuristic returns null.
 *   3. Merge and return.
 *
 * The whole result is cached per url-set fingerprint (14d) so repeat cohort
 * runs make zero LLM calls.
 */
export async function classifyContentTypes(
  urls: string[],
): Promise<Array<{ url: string; type: ContentType }>> {
  if (urls.length === 0) return [];

  // Cache key fingerprinted on sorted url set (order-independent).
  const fingerprint = [...urls].sort().slice(0, 40).join("|");
  // Use v2 prefix to avoid stale "all-other" entries from the initial LLM-only attempt.
  const cacheKey = `ct-classify-v2:${fingerprint}`;

  return cachedJson(cacheKey, 14 * DAY_MS, async () => {
    // Step 1: heuristic pre-pass.
    const heuristicResults = new Map<string, ContentType>();
    const uncertain: string[] = [];
    for (const url of urls) {
      const t = inferTypeFromUrl(url);
      if (t !== null) heuristicResults.set(url, t);
      else uncertain.push(url);
    }

    // Step 2: LLM for uncertain URLs (skip when none remain, or in fixtures mode
    // — the live run needs a real key; uncertain URLs then fall back to "other").
    const llmResults = new Map<string, ContentType>();
    if (uncertain.length > 0 && !fixturesEnabled()) {
      const list = uncertain.map((url, i) => `${i + 1}. ${url}`).join("\n");
      try {
        const { text } = await callModel({
          model: "claude-haiku-4-5-20251001",
          system: "You classify URLs by content type. Return only a JSON array, no prose.",
          prompt: `Classify each URL into EXACTLY ONE type from: guide | comparison | listicle | landing | tool | blog | docs | other.

Definitions:
- guide: in-depth tutorial or step-by-step how-to (/guide/, /tutorial/, how-to-* slugs)
- comparison: A vs B, alternatives, best-X lists (/vs/, /alternatives/, /compare/)
- listicle: top-N or N-best posts (top-10-*, best-*, *-list)
- landing: homepage, product/features/pricing pages (root /, /pricing, /features)
- tool: interactive tool, calculator, generator, checker
- blog: general blog post or article
- docs: documentation, help centre, support article (/docs/, /help/, /support/)
- other: none of the above

URLS TO CLASSIFY:
${list}

Return ONLY a JSON array:
[{ "url": "<exact url from list>", "type": "<type>" }]`,
          scanId: null,
          stage: "extract",
          maxTokens: 2048,
        });
        const parsed = parseContentTypeClassifications(text, uncertain);
        for (const { url, type } of parsed) llmResults.set(url, type);
      } catch {
        // LLM failed — uncertain URLs stay as "other" (safe fallback)
      }
    }

    // Step 3: merge in input order: heuristic wins over LLM.
    return urls.map((url) => ({
      url,
      type: heuristicResults.get(url) ?? llmResults.get(url) ?? "other",
    }));
  });
}

// ---------------------------------------------------------------------------
// Topic clustering (LLM, whole-cohort) — exported for unit tests
// ---------------------------------------------------------------------------

export interface ClusterAssignment {
  url: string;
  cluster: string;
}

export interface ParsedClusters {
  pageAssignments: ClusterAssignment[];
}

/**
 * Parse a raw JSON string from the model into cluster assignments.
 * Input format: [{ "cluster": "...", "urls": ["..."] }]
 */
export function parseClusterAssignments(
  raw: string,
  allUrls: string[],
): ParsedClusters {
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (!Array.isArray(parsed)) return { pageAssignments: allUrls.map((url) => ({ url, cluster: "general" })) };

    const urlToCluster = new Map<string, string>();
    for (const item of parsed) {
      const o = item as Record<string, unknown>;
      const cluster = String(o.cluster ?? o.label ?? "").trim();
      if (!cluster) continue;
      const urls = Array.isArray(o.urls) ? o.urls.map(String) : [];
      for (const u of urls) urlToCluster.set(u.trim(), cluster);
    }

    return {
      pageAssignments: allUrls.map((url) => ({
        url,
        cluster: urlToCluster.get(url) ?? "other",
      })),
    };
  } catch {
    return { pageAssignments: allUrls.map((url) => ({ url, cluster: "general" })) };
  }
}

/**
 * Cluster all cohort pages into 6–10 SHARED topic clusters via a single Haiku
 * LLM call. Shared taxonomy = every domain's pages are tagged with the same
 * set of clusters, enabling "who covers which topic" comparison.
 */
export async function clusterPageTopics(
  pages: Array<{ domain: string; url: string }>,
): Promise<ParsedClusters> {
  if (pages.length === 0) return { pageAssignments: [] };

  const fingerprint = [...pages].map((p) => p.url).sort().slice(0, 40).join("|");
  const cacheKey = `ct-cluster:${fingerprint}`;

  return cachedJson(cacheKey, 14 * DAY_MS, async () => {
    const list = pages.map((p, i) => `${i + 1}. [${p.domain}] ${p.url}`).join("\n");
    const allUrls = pages.map((p) => p.url);

    // Fixtures mode: no LLM call — default every page to a single neutral cluster.
    if (fixturesEnabled()) return { pageAssignments: allUrls.map((url) => ({ url, cluster: "general" })) };

    try {
      const { text } = await callModel({
        model: "claude-haiku-4-5-20251001",
        system: "You group competitor URLs into shared topic clusters for competitive analysis. Return only a JSON array, no prose.",
        prompt: `Below are organic pages from competing websites. Group them into 6–10 SHARED TOPIC CLUSTERS that apply equally across all companies (so we can compare who covers which topic).

A cluster = a coherent topic that multiple companies might write about (e.g. "SEO guides", "Pricing pages", "Free tools", "Integration docs"). Assign EVERY url to exactly one cluster — use "other" for pages that don't fit any meaningful cluster.

PAGES:
${list}

Return ONLY a JSON array (no prose, no markdown):
[{ "cluster": "<short label, max 4 words>", "urls": ["<exact url1>", "<exact url2>", ...] }]`,
        scanId: null,
        stage: "extract",
        maxTokens: 3072,
      });

      return parseClusterAssignments(text, allUrls);
    } catch {
      return { pageAssignments: pages.map((p) => ({ url: p.url, cluster: "general" })) };
    }
  });
}

// ---------------------------------------------------------------------------
// Word-count fetch (best-effort, one page per entity)
// ---------------------------------------------------------------------------

/** Fetch the word count from the body text of a URL. Returns 0 on any failure. */
async function fetchWordCount(rawUrl: string): Promise<number> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  try {
    const res = await fetchWithTimeout(url, { redirect: "follow" }, 10_000);
    if (!res.ok) return 0;
    const html = (await res.text()).slice(0, 800_000);
    const root = parse(html);
    const body = (root.querySelector("body")?.text ?? "").replace(/\s+/g, " ").trim();
    return body ? body.split(" ").length : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Structured persistence (domain_content_page table)
// ---------------------------------------------------------------------------

/**
 * Upsert classified page rows into `domain_content_page`.
 * Best-effort — any write error is logged and swallowed so it never breaks the
 * gather. Called via `void ...catch(...)` so it doesn't block the return.
 */
async function persistContentPages(entities: ContentEntity[]): Promise<void> {
  const db = serverDb();
  const rows = entities.flatMap((entity) =>
    entity.pages.map((page) => ({
      domain: entity.domain,
      url: page.url,
      title: page.title ?? null,
      content_type: page.contentType,
      topic_cluster: page.cluster,
      keyword_count: page.keywordCount,
      // ETV from DataForSEO is a float; the column is bigint — round to integer.
      etv: Math.round(page.etv),
      word_count: page.wordCount,
      fetched_at: new Date().toISOString(),
    })),
  );

  if (rows.length === 0) return;

  // Upsert in chunks of 100 to stay well within Postgres parameter limits.
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    try {
      await db
        .from("domain_content_page")
        .upsert(rows.slice(i, i + CHUNK), { onConflict: "domain,url" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[domain_content_page] chunk ${i} persist failed: ${msg}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Gather the full content-effectiveness intelligence for a subject + cohort.
 * Cached 7 days (content-intel:<self>:<cohortKey>) — exactly like gatherDemand
 * and gatherFullFunnel.
 */
export async function gatherContentIntel(
  rawSelf: string,
  opts: { competitorDomains?: string[]; onStage?: OnStageCallback } = {},
): Promise<ContentIntel> {
  const self = normalizeHost(rawSelf);
  const cohortKey = (opts.competitorDomains ?? [])
    .map((d) => d.toLowerCase())
    .sort()
    .join(",");

  return cachedJson(`content-intel:${self}:${cohortKey}`, 7 * DAY_MS, async () => {
    // Stage fired inside cachedJson body — cold computes only.
    opts.onStage?.({ key: "content:analyze", label: "Analyzing winning content" });

    // 1. Resolve cohort (user-selected when provided, else auto closeness-ranked).
    const cohortResult = await cohortFor(self, opts.competitorDomains);
    const competitors = cohortResult.ranked.slice(0, 4).map((r) => r.domain);
    const allDomains = [self, ...competitors];

    // 2. Fetch top pages for each domain from the 14d global cache — zero new
    //    DataForSEO calls on repeat runs.
    const pagesByDomain = await Promise.all(
      allDomains.map(async (domain) => {
        const pages = await cachedRelevantPages(domain, PAGES_PER_ENTITY);
        return { domain, pages };
      }),
    );

    // 3. Collect all raw (url, domain) pairs for the LLM calls.
    const allPagesFlat = pagesByDomain.flatMap(({ domain, pages }) =>
      pages.map((p) => ({ domain, url: p.url, keywordCount: p.keywordCount, etv: p.etv })),
    );
    const allUrls = allPagesFlat.map((p) => p.url);

    // 4a. Content-type classification — one batched Haiku call for all URLs.
    // 4b. Topic clustering — one Haiku call for the whole cohort's pages.
    // Run in parallel since they're independent.
    const [typeResults, clusterResult] = await Promise.all([
      classifyContentTypes(allUrls),
      clusterPageTopics(allPagesFlat.map((p) => ({ domain: p.domain, url: p.url }))),
    ]);

    const typeOf = new Map<string, ContentType>(typeResults.map((r) => [r.url, r.type]));
    const clusterOf = new Map<string, string>(
      clusterResult.pageAssignments.map((a) => [a.url, a.cluster]),
    );

    // 5. Word count: fetch only the single highest-ETV page per entity, bounded
    //    to avoid too many parallel HTTP fetches. Failures degrade to 0 silently.
    const topPageUrls = pagesByDomain
      .map(({ domain, pages }) => {
        const top = [...pages].sort((a, b) => b.etv - a.etv)[0];
        return { domain, url: top?.url ?? null };
      })
      .filter((x): x is { domain: string; url: string } => !!x.url);

    const wordCountResults = await Promise.all(
      topPageUrls.map(async ({ url }) => {
        const wc = await fetchWordCount(url).catch(() => 0);
        return { url, wordCount: wc };
      }),
    );
    const wordCountOf = new Map<string, number>(
      wordCountResults.map((r) => [r.url, r.wordCount]),
    );

    // 6. Assemble per-entity data.
    const entities: ContentEntity[] = pagesByDomain.map(({ domain, pages }) => {
      const contentPages: ContentPage[] = pages.map((p) => ({
        url: p.url,
        contentType: typeOf.get(p.url) ?? "other",
        cluster: clusterOf.get(p.url) ?? "other",
        keywordCount: p.keywordCount,
        etv: p.etv,
        wordCount: wordCountOf.get(p.url) ?? 0,
      }));

      // Build content-type mix count.
      const contentTypeMix: Partial<Record<ContentType, number>> = {};
      for (const cp of contentPages) {
        contentTypeMix[cp.contentType] = (contentTypeMix[cp.contentType] ?? 0) + 1;
      }

      return {
        domain,
        isSubject: domain === self,
        contentTypeMix,
        pages: contentPages,
      };
    });

    // 7. Build cohort-wide cluster summary (label → total pages + covered domains).
    const clusterMap = new Map<string, { totalPages: number; coveredBy: Set<string> }>();
    for (const entity of entities) {
      for (const page of entity.pages) {
        if (!page.cluster) continue;
        if (!clusterMap.has(page.cluster)) {
          clusterMap.set(page.cluster, { totalPages: 0, coveredBy: new Set() });
        }
        const entry = clusterMap.get(page.cluster)!;
        entry.totalPages++;
        entry.coveredBy.add(entity.domain);
      }
    }

    const clusters: Cluster[] = [...clusterMap.entries()]
      .map(([label, { totalPages, coveredBy }]) => ({
        label,
        totalPages,
        coveredBy: [...coveredBy],
      }))
      .sort((a, b) => b.totalPages - a.totalPages);

    const result: ContentIntel = { subjectDomain: self, entities, clusters };

    // 8. Persist classified rows to structured storage (best-effort, never blocks).
    void persistContentPages(entities).catch((err) =>
      console.error("[content] batch persist error:", err),
    );

    return result;
  });
}
