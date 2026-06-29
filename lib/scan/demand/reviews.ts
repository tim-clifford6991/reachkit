/**
 * Competitor-review mining — the "no-reviews" unlock.
 *
 * The user (an indie founder) has no reviews, but their COMPETITORS do. We find
 * the competitors' review pages (G2 / Capterra / Product Hunt / Trustpilot),
 * extract the text, and have the LLM distill the whole category's buyer evidence:
 * the pains buyers complain about, what they love, who they are (personas), and
 * the exact language they use. Cached per cohort (reviews move very slowly).
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { tavilySearch, tavilyExtract } from "@/lib/scan/adapters/tavily";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";

const REVIEW_SITES = ["g2.com", "capterra.com", "producthunt.com", "trustpilot.com", "getapp.com", "softwareadvice.com"];

export interface BuyerInsights {
  /** What buyers complain about / unmet needs. */
  pains: string[];
  /** What buyers love (table-stakes + delighters). */
  lovedFeatures: string[];
  /** Who the buyers are (roles, company types, contexts). */
  personas: string[];
  /** Verbatim phrases buyers use (for copy + keyword angles). */
  buyerLanguage: string[];
  /** Review pages mined. */
  sources: string[];
}

const EMPTY: BuyerInsights = { pains: [], lovedFeatures: [], personas: [], buyerLanguage: [], sources: [] };
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []);

export async function mineCompetitorReviews(competitors: string[], category: string): Promise<BuyerInsights> {
  const cohort = [...new Set(competitors.map((c) => c.toLowerCase()))].slice(0, 3);
  if (cohort.length === 0) return EMPTY;
  const key = `reviews:${cohort.sort().join(",")}`;

  return cachedJson(key, 60 * DAY_MS, async () => {
    // 1. Find competitor review pages.
    const searches = await Promise.all(
      cohort.map((c) => tavilySearch(`${c} reviews`, { includeDomains: REVIEW_SITES, maxResults: 6 }).catch(() => [])),
    );
    // Keep only ACTUAL review pages that extract well. G2 redirect/compare/seller
    // /marketplace pages (and event-tracking links) are blocked or content-free —
    // ProductHunt /reviews, Trustpilot /review/, Capterra reviews carry the signal.
    const isReviewPage = (u: string) =>
      !/event_tracking|\/compare\/|\/sellers\/|\/marketplace\//.test(u) &&
      (/\/reviews?\b/i.test(u) || /trustpilot\.com\/review\//.test(u) || /producthunt\.com\/products\/[^/]+\/reviews/.test(u));
    const urls = [...new Set(searches.flat().map((r) => r.url).filter((u) => u && isReviewPage(u)))].slice(0, 8);
    if (urls.length === 0) return EMPTY;

    // 2. Extract the review text.
    const extracted = await tavilyExtract(urls).catch(() => []);
    const text = extracted.map((e) => e.content).join("\n\n").slice(0, 14_000);
    if (!text.trim()) return { ...EMPTY, sources: urls };

    // 3. Distill buyer evidence.
    try {
      const { text: out } = await callModel({
        model: "claude-haiku-4-5-20251001",
        system: "You distill SaaS buyer evidence from review text into structured demand signal. Return only JSON.",
        prompt: `Below is review text for products in the "${category}" category. Extract what the WHOLE CATEGORY's buyers reveal — pains, what they love, who they are, and the words they use.

REVIEWS:
${text}

Return ONLY this JSON:
{
  "pains": ["<unmet needs / complaints buyers raise>"],
  "lovedFeatures": ["<what buyers value most>"],
  "personas": ["<who the buyers are — roles, team types, contexts>"],
  "buyerLanguage": ["<verbatim phrases buyers use to describe the problem/solution>"]
}
Each list 4–8 items, specific and grounded in the text.`,
        scanId: null,
        stage: "extract",
        maxTokens: 2048,
      });
      const p = JSON.parse(extractJson(out)) as Record<string, unknown>;
      return {
        pains: arr(p.pains).slice(0, 8),
        lovedFeatures: arr(p.lovedFeatures).slice(0, 8),
        personas: arr(p.personas).slice(0, 8),
        buyerLanguage: arr(p.buyerLanguage).slice(0, 8),
        sources: urls,
      };
    } catch {
      return { ...EMPTY, sources: urls };
    }
  });
}
