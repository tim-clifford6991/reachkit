/**
 * Demand layer orchestrator (test harness).
 *
 * Buyer-anchored, review-INDEPENDENT demand intelligence for a product:
 *   - ICP hypothesis (LLM from homepage)
 *   - search demand: keyword ideas → volume/intent → LLM-clustered themes
 *   - community: pain queries → where buyers ask (reuses existing discoverDemand)
 *   - buyer insights: pains/personas/language mined from COMPETITORS' reviews
 *
 * Everything is cached (Phase-1 global cache) so repeat runs are ~free.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cohortFor, cachedKeywordIdeas } from "@/lib/scan/cache/cached-adapters";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { inferProductBrief, type ICP } from "@/lib/scan/demand/brief";
import { mineCompetitorReviews, type BuyerInsights } from "@/lib/scan/demand/reviews";
import { discoverDemand } from "@/lib/scan/demand/index";
import type { DemandPocket } from "@/lib/scan/demand/types";
import type { KeywordIdea } from "@/lib/scan/adapters/dataforseo-keyword-ideas";

export interface DemandTheme {
  theme: string;
  totalVolume: number;
  intent: string;
  sampleKeywords: string[];
}

export interface DemandIntel {
  domain: string;
  category: string;
  icp: ICP;
  searchDemand: {
    totalAddressableVolume: number;
    topKeywords: KeywordIdea[];
    themes: DemandTheme[];
  };
  community: {
    painQueries: string[];
    pockets: DemandPocket[];
  };
  buyerInsights: BuyerInsights;
}

async function clusterKeywordThemes(ideas: KeywordIdea[], category: string): Promise<DemandTheme[]> {
  const top = ideas.slice(0, 120);
  if (top.length < 3) return [];
  const cacheKey = `kwtheme:${category}:${[...top].map((k) => k.keyword).sort().slice(0, 25).join("|")}`;
  return cachedJson(cacheKey, 30 * DAY_MS, async () => {
    const list = top.map((k) => `${k.keyword} (${k.volume}/mo${k.intent ? `, ${k.intent}` : ""})`).join("\n");
    try {
      const { text } = await callModel({
        model: "claude-haiku-4-5-20251001",
        system: "You group search keywords into buyer-demand themes. Return only a JSON array.",
        prompt: `Group these "${category}" search keywords into 6–8 DEMAND THEMES (jobs/problems a BUYER of this product searches for). Each theme = a coherent buyer need.

KEYWORDS:
${list}

DROP keywords that are NOT buyer demand for this product: named events/conferences (e.g. "fomc meeting", "asco meeting"), organization/person names, news queries, and pure dictionary lookups ("X meaning", "X defined"). Keep only keywords a prospective buyer would search while looking to solve the problem.

Return ONLY a JSON array, biggest-demand themes first:
[ { "theme": "<short theme name>", "intent": "informational|commercial|transactional", "sampleKeywords": ["<3-5 of the kept keywords above>"] } ]`,
        scanId: null,
        stage: "extract",
        maxTokens: 2048,
      });
      const parsed = JSON.parse(extractJson(text));
      if (!Array.isArray(parsed)) return [];
      const volOf = new Map(top.map((k) => [k.keyword.toLowerCase(), k.volume]));
      // Per-keyword intent from keyword_ideas (search_intent) — more reliable than
      // the LLM blanket-labeling every theme "informational".
      const intentOf = new Map(top.filter((k) => k.intent).map((k) => [k.keyword.toLowerCase(), String(k.intent).toLowerCase()]));
      const dominantIntent = (kws: string[]): string | null => {
        const counts: Record<string, number> = {};
        for (const kw of kws) { const it = intentOf.get(kw.toLowerCase()); if (it) counts[it] = (counts[it] ?? 0) + 1; }
        const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return winner ? winner[0] : null;
      };
      return parsed
        .map((t) => {
          const o = t as Record<string, unknown>;
          const sampleKeywords = (Array.isArray(o.sampleKeywords) ? o.sampleKeywords.map(String) : []).slice(0, 6);
          const totalVolume = sampleKeywords.reduce((s, kw) => s + (volOf.get(kw.toLowerCase()) ?? 0), 0);
          const intent = dominantIntent(sampleKeywords) ?? String(o.intent ?? "informational");
          return { theme: String(o.theme ?? "").trim(), intent, sampleKeywords, totalVolume };
        })
        .filter((t) => t.theme)
        .sort((a, b) => b.totalVolume - a.totalVolume);
    } catch {
      return [];
    }
  });
}

// Generic SaaS words that, as a keyword-ideas seed token, drag in the whole
// software universe (accounting/CRM/etc.). We filter results to keep only ideas
// that share a DISTINCTIVE topic token from the seeds.
const GENERIC_TOKENS = new Set([
  "software", "tool", "tools", "app", "apps", "platform", "ai", "best", "free", "online",
  "system", "solution", "solutions", "service", "services", "for", "the", "and", "of",
]);
function topicTokens(seeds: string[]): Set<string> {
  const t = new Set<string>();
  for (const s of seeds) for (const w of s.toLowerCase().split(/\s+/)) if (w.length >= 4 && !GENERIC_TOKENS.has(w)) t.add(w);
  return t;
}

export async function gatherDemand(rawSelf: string, opts: { competitorDomains?: string[] } = {}): Promise<DemandIntel> {
  const self = normalizeHost(rawSelf);
  const cohortKey = (opts.competitorDomains ?? []).map((d) => d.toLowerCase()).sort().join(",");
  // Persist the assembled demand intel so repeat dashboard loads are instant.
  return cachedJson(`demand-intel:${self}:${cohortKey}`, 7 * DAY_MS, async () => {
  const brief = await inferProductBrief(self);
  const competitors = (await cohortFor(self, opts.competitorDomains)).ranked.slice(0, 4).map((r) => r.domain);

  // Compute the SEARCH SIGNALS (keyword demand + buyer pains) first — they seed the
  // Reddit community search so it finds many subreddits/threads per theme/pain.
  const [rawIdeas, buyerInsights] = await Promise.all([
    cachedKeywordIdeas(brief.seedKeywords),
    mineCompetitorReviews(competitors, brief.category),
  ]);

  // Keep only ideas containing a DISTINCTIVE category noun (drops generic-SaaS +
  // dictionary noise like "preparation meaning"). Prefer the model's coreTerms;
  // fall back to seed-derived tokens.
  const tokens = brief.coreTerms.length ? new Set(brief.coreTerms) : topicTokens(brief.seedKeywords);
  const ideas = tokens.size
    ? rawIdeas.filter((k) => { const kw = k.keyword.toLowerCase(); return [...tokens].some((t) => kw.includes(t)); })
    : rawIdeas;

  const themes = await clusterKeywordThemes(ideas, brief.category);

  // Reddit community search grounded ONLY in the PRODUCT's own problem —
  // generatePainQueries derives product-specific pain queries broken into angles
  // (each tagged with its angle = the UI theme). We deliberately do NOT seed from
  // generic theme keywords or competitor-review pains: those drift off-topic to
  // unrelated category threads and lose the context of what THIS product does.
  const demand = await cachedJson(`demand:${self}:${cohortKey}`, 30 * DAY_MS, () =>
    discoverDemand({ brand: brief.brand, problem: brief.problem, audience: brief.audience, valueProp: brief.valueProp }, { queryCap: 10, maxHits: 80 }),
  );

  // Top-keywords table = only keywords the theme-clustering KEPT (it already drops
  // news/events/dictionary noise) minus navigational (competitor-brand) terms — so
  // the table reflects real buyer demand, not "fomc meeting"-style pollution.
  const themeKw = new Set(themes.flatMap((t) => t.sampleKeywords.map((k) => k.toLowerCase())));
  const cleaned = ideas.filter((k) => themeKw.has(k.keyword.toLowerCase()) && (k.intent ?? "").toLowerCase() !== "navigational");
  const topKeywords = (cleaned.length >= 5 ? cleaned : ideas).slice(0, 25);

  return {
    domain: self,
    category: brief.category,
    icp: brief.icp,
    searchDemand: {
      totalAddressableVolume: ideas.reduce((s, k) => s + k.volume, 0),
      topKeywords,
      themes,
    },
    community: { painQueries: demand.painQueries, pockets: demand.pockets },
    buyerInsights,
  };
  });
}
