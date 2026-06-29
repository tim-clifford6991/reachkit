/**
 * Product-derived demand brief + ICP (the demand seed).
 *
 * Reads the product's homepage and hypothesizes who the buyer is, the problem,
 * the jobs-to-be-done, and the seed keywords for demand mining — with ZERO
 * reviews required (the indie-founder reality). Everything else in the demand
 * layer validates/enriches this. Produces the `ProductBrief` shape the existing
 * `discoverDemand` engine consumes, plus a richer ICP and keyword seeds.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fetchSiteBlurb } from "@/lib/scan/referral/llm-competitors";
import { productNameFromHost } from "@/lib/scan/referral/discover-competitors";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import type { ProductBrief } from "@/lib/scan/demand/types";

export interface ICP {
  whoItsFor: string;
  jobsToBeDone: string[];
  useCases: string[];
}

export interface ProductDemandBrief extends ProductBrief {
  category: string;
  /** Category keyword seeds for demand mining (NOT the brand name). */
  seedKeywords: string[];
  /** 1-3 DISTINCTIVE nouns a relevant search must contain (e.g. "meeting"). */
  coreTerms: string[];
  icp: ICP;
  blurb: string;
}

export function buildBriefPrompt(productName: string, host: string, blurb: string): string {
  return `Analyze this product and infer its market demand profile.

PRODUCT:
- Name: ${productName}
- Site: ${host}
- Homepage: ${blurb || "(infer from name/domain)"}

Return ONLY this JSON (no fences):
{
  "problem": "<one sentence: the core problem it solves, plain terms>",
  "audience": "<who has that problem — the buyer>",
  "valueProp": "<what it offers / why it's better>",
  "category": "<specific micro-category>",
  "seedKeywords": ["<3-6 CATEGORY search terms a buyer would Google — NOT the brand name>"],
  "coreTerms": ["<1-3 MOST DISTINCTIVE nouns that a genuinely relevant search MUST contain, e.g. 'meeting', 'briefing' — NEVER generic words like 'software', 'preparation', 'automation', 'tool'>"],
  "icp": {
    "whoItsFor": "<the ideal customer in one line>",
    "jobsToBeDone": ["<3-5 jobs the buyer is hiring this to do>"],
    "useCases": ["<3-5 concrete use cases>"]
  }
}

Rules: seedKeywords must be generic category terms (e.g. "meeting notes software", "sales call prep"), never the product's own brand. Be concrete and specific to THIS product's actual positioning.`;
}

export async function inferProductBrief(domain: string): Promise<ProductDemandBrief> {
  return cachedJson(`brief:${domain.toLowerCase()}`, 30 * DAY_MS, async () => {
    const brand = productNameFromHost(domain);
    const blurb = await fetchSiteBlurb(domain);
    const empty: ProductDemandBrief = {
      brand, problem: "", audience: "", valueProp: "", category: "", seedKeywords: [], coreTerms: [], blurb,
      icp: { whoItsFor: "", jobsToBeDone: [], useCases: [] },
    };
    try {
      const { text } = await callModel({
        model: "claude-haiku-4-5-20251001",
        system: "You profile a product's market demand from its homepage. Return only JSON.",
        prompt: buildBriefPrompt(brand, domain, blurb),
        scanId: null,
        stage: "extract",
      });
      const p = JSON.parse(extractJson(text)) as Record<string, unknown>;
      const icp = (p.icp ?? {}) as Record<string, unknown>;
      const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []);
      return {
        brand,
        problem: String(p.problem ?? "").trim(),
        audience: String(p.audience ?? "").trim(),
        valueProp: String(p.valueProp ?? "").trim(),
        category: String(p.category ?? "").trim(),
        seedKeywords: arr(p.seedKeywords).slice(0, 6),
        coreTerms: arr(p.coreTerms).map((s) => s.toLowerCase()).slice(0, 3),
        icp: { whoItsFor: String(icp.whoItsFor ?? "").trim(), jobsToBeDone: arr(icp.jobsToBeDone).slice(0, 5), useCases: arr(icp.useCases).slice(0, 5) },
        blurb,
      };
    } catch {
      return empty;
    }
  });
}
