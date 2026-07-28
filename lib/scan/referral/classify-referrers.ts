/**
 * Categorize a competitor's REFERRING sites into real discovery channels, so the
 * user can see HOW competitors are found — and so the pervasive low-value
 * "AI-tool directory" auto-listing spam (neyropoisk.com, aitoolnet.com, ai123.cn…)
 * is recognized as its own bucket rather than masquerading as signal.
 *
 * Classifies by hostname (the LLM recognizes most), one batched call for the cohort.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";

export type ReferrerCategory =
  | "marketplace" // G2, Capterra, Product Hunt, AppSumo — list & get reviews
  | "software_directory" // quality SaaS catalogs (AlternativeTo, SaaSHub, Slant)
  | "ai_directory" // auto-generated AI-tool listing aggregators — LOW value, ubiquitous
  | "blog" // editorial/content blogs (incl. company blogs that publish guests)
  | "media" // news / tech press
  | "community" // Reddit, HN, forums, dev.to, Indie Hackers
  | "social" // social platforms
  | "newsletter" // newsletters / Substack / beehiiv
  | "partner" // integration / partner / "works with" pages
  | "spam" // link farms, scrapers, clearly junk
  | "other";

/** Channels that represent a real, pursuable discovery path (vs. low-value noise). */
export const QUALITY_CATEGORIES: ReferrerCategory[] = [
  "marketplace", "software_directory", "blog", "media", "community", "social", "newsletter", "partner",
];
export const LOW_VALUE_CATEGORIES: ReferrerCategory[] = ["ai_directory", "spam", "other"];

const ALL = new Set<string>([...QUALITY_CATEGORIES, ...LOW_VALUE_CATEGORIES]);

function buildPrompt(productCategory: string, hosts: string[]): string {
  return `Categorize each referring website by what KIND of site it is. Context: these sites link to products in the "${productCategory}" category.

CATEGORIES:
- marketplace: software review/listing platforms — G2, Capterra, GetApp, Product Hunt, AppSumo, Trustpilot
- software_directory: curated SaaS catalogs — AlternativeTo, SaaSHub, Slant, Software Advice
- ai_directory: AUTO-GENERATED "AI tools" listing aggregators that scrape & list every AI tool — usually generic names (aitoolnet, findaitools, toolify, aitop365), foreign ccTLDs (.cn/.jp/.br/.top/.cc), low editorial value. Be aggressive labeling these.
- blog: editorial/content blogs and company blogs that publish articles
- media: news outlets / tech press (TechCrunch, VentureBeat, Forbes…)
- community: forums & communities — Reddit, Hacker News, dev.to, Indie Hackers, Quora, Stack Overflow
- social: social platforms
- newsletter: newsletters / Substack / beehiiv issues
- partner: integration directories / partner / "works with X" pages of other products
- spam: link farms, scrapers, parked domains, clearly junk
- other: anything that doesn't fit

HOSTS:
${hosts.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Return ONLY a JSON array, one entry per host, using the host verbatim:
[ { "host": "<host>", "category": "<category>" } ]`;
}

// Hosts are CHUNKED so no single model response can overrun the output ceiling
// and truncate mid-array. Regression (66e12d0): the cap was raised 150→400 in
// ONE 4096-token call — 400 entries ≈ ~8k output tokens, so the response
// truncated, JSON.parse threw, the map came back EMPTY, every host fell to
// "other", and the gap-map read all-"None" for the whole cohort (subject
// included). ~100 hosts/batch keeps each response well under 4096; a failed
// batch degrades only its own hosts, never the whole map.
const CLASSIFY_BATCH = 100;
const CLASSIFY_CAP = 400; // cohort union bound (cost) — now spread across batches

/** host → category. Never throws → empty map on failure (caller treats as "other"). */
export async function classifyReferrers(hosts: string[], productCategory: string): Promise<Map<string, ReferrerCategory>> {
  const out = new Map<string, ReferrerCategory>();
  const unique = [...new Set(hosts)].slice(0, CLASSIFY_CAP);
  if (unique.length === 0) return out;

  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += CLASSIFY_BATCH) batches.push(unique.slice(i, i + CLASSIFY_BATCH));

  const maps = await Promise.all(batches.map((b) => classifyBatch(b, productCategory)));
  for (const m of maps) for (const [h, c] of m) out.set(h, c);
  return out;
}

/** One batch → its host→category map. Isolated try/catch so a single truncated
 *  or malformed batch never zeroes the others. */
async function classifyBatch(hosts: string[], productCategory: string): Promise<Map<string, ReferrerCategory>> {
  const out = new Map<string, ReferrerCategory>();
  try {
    const { text } = await callModel({
      model: "claude-haiku-4-5-20251001",
      system: "You classify referring websites into discovery-channel categories by hostname. Label auto-generated AI-tool listing aggregators as ai_directory. Return only a JSON array.",
      prompt: buildPrompt(productCategory, hosts),
      scanId: null,
      stage: "extract",
      maxTokens: 4096,
    });
    const parsed = JSON.parse(extractJson(text));
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const o = item as Record<string, unknown>;
        const host = String(o.host ?? "").trim().toLowerCase();
        const cat = String(o.category ?? "other") as ReferrerCategory;
        if (host && ALL.has(cat)) out.set(host, cat);
      }
    }
  } catch {
    /* this batch degrades to "other"; siblings still classify */
  }
  return out;
}
