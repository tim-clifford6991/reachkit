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

/** A mined buyer pain with (when known) the exact review it came from. */
export interface PainInsight {
  text: string;
  quote?: string;
  sourceUrl?: string;
  mentions?: number;
}

export interface BuyerInsights {
  /** What buyers complain about / unmet needs, each with source provenance when known. */
  pains: PainInsight[];
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

/**
 * Accepts either legacy `pains: string[]` (older cached/persisted payloads) or the
 * new `PainInsight[]` shape, and normalises both into `PainInsight[]`. Used on
 * read-back so consumers never have to branch on the stored shape themselves.
 */
export function normalizePains(raw: unknown): PainInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: PainInsight[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push({ text: t });
    } else if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      const o = item as Record<string, unknown>;
      const text = String(o.text).trim();
      if (!text) continue;
      out.push({
        text,
        quote: typeof o.quote === "string" && o.quote.trim() ? o.quote.trim() : undefined,
        sourceUrl: typeof o.sourceUrl === "string" && /^https?:\/\//i.test(o.sourceUrl) ? o.sourceUrl : undefined,
        mentions: typeof o.mentions === "number" ? o.mentions : undefined,
      });
    }
  }
  return out;
}

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
    const reviewResults = searches.flat().filter((r) => r.url && isReviewPage(r.url));
    const urls = [...new Set(reviewResults.map((r) => r.url))].slice(0, 8);
    if (urls.length === 0) return EMPTY;

    // 2. Gather review text. Full-page extraction is the richest source, but the
    //    big review sites (G2 / Capterra / Trustpilot) frequently bot-block it and
    //    return empty content — which silently zeroed buyer insights even though we
    //    found real review pages. So ALSO use the search-result snippets, which
    //    always come back and carry verbatim review excerpts. Snippets are the floor.
    // Label each excerpt with a short [S#] tag → the LLM cites which the pain came from.
    const labelled = reviewResults.slice(0, 12).map((r, i) => ({ tag: `S${i + 1}`, url: r.url, text: `${r.title}\n${r.content}`.trim() }));
    const sourceByTag = new Map(labelled.map((l) => [l.tag, l.url]));
    const snippetText = labelled.filter((l) => l.text).map((l) => `[${l.tag}] ${l.text}`).join("\n\n");
    const extracted = await tavilyExtract(urls).catch(() => []);
    const extractText = extracted.map((e) => e.content).filter(Boolean).join("\n\n");
    const text = [snippetText, extractText].filter(Boolean).join("\n\n").slice(0, 14_000);
    if (!text.trim()) return { ...EMPTY, sources: urls };

    // 3. Distill buyer evidence.
    try {
      const { text: out } = await callModel({
        model: "claude-haiku-4-5-20251001",
        system: "You distill SaaS buyer evidence from review text into structured demand signal. Return only JSON.",
        prompt: `Below is review text for products in the "${category}" category, labelled with [S#] source tags. Extract what the WHOLE CATEGORY's buyers reveal — pains, what they love, who they are, and the words they use.

REVIEWS:
${text}

Return ONLY this JSON:
{
  "pains": [ { "text": "<unmet need / complaint>", "quote": "<short verbatim phrase>", "source": "<the [S#] tag of the excerpt it came from>" } ],
  "lovedFeatures": ["<what buyers value most>"],
  "personas": ["<who the buyers are — roles, team types, contexts>"],
  "buyerLanguage": ["<verbatim phrases buyers use to describe the problem/solution>"]
}
Each list 4–8 items, specific and grounded in the text. Every pain MUST cite the "source" tag of the excerpt it was drawn from.`,
        scanId: null,
        stage: "extract",
        maxTokens: 2048,
      });
      const p = JSON.parse(extractJson(out)) as Record<string, unknown>;
      const rawPains = Array.isArray(p.pains) ? p.pains : [];
      const pains: PainInsight[] = rawPains.map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const text = String(o.text ?? "").trim();
        if (!text) return null;
        const tag = String(o.source ?? "").trim().toUpperCase();
        return { text, quote: typeof o.quote === "string" ? o.quote.trim() || undefined : undefined, sourceUrl: sourceByTag.get(tag) };
      }).filter(Boolean).slice(0, 8) as PainInsight[];
      return {
        pains,
        lovedFeatures: arr(p.lovedFeatures).slice(0, 8),
        personas: arr(p.personas).slice(0, 8),
        buyerLanguage: arr(p.buyerLanguage).slice(0, 8),
        sources: urls,
      };
    } catch {
      return { ...EMPTY, sources: urls };
    }
  }, {
    // The two early `return EMPTY` / `return { ...EMPTY, sources }` paths (no
    // review pages found, or extraction bot-blocked) plus a total LLM failure
    // are transient poison — don't cache a blank buyer-insights payload for 60d.
    isEmpty: (v) => v.pains.length === 0 && v.lovedFeatures.length === 0 && v.personas.length === 0 && v.buyerLanguage.length === 0,
  });
}
