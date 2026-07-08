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
import { MAX_SELECTED } from "@/lib/scan/competitor-selection";
import { cachedJson, DAY_MS } from "@/lib/scan/cache/external-cache";
import { inferProductBrief, type ICP, type ProductDemandBrief } from "@/lib/scan/demand/brief";
import { mineCompetitorReviews, type BuyerInsights } from "@/lib/scan/demand/reviews";
import { discoverDemand } from "@/lib/scan/demand/index";
import type { DemandPocket } from "@/lib/scan/demand/types";
import type { KeywordIdea } from "@/lib/scan/adapters/dataforseo-keyword-ideas";
import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import type { OnStageCallback } from "@/lib/scan/types";

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

DROP keywords that are NOT buyer demand for a "${category}" product. This includes:
- OFF-CATEGORY terms that only loosely share a word but a buyer of THIS product would never search. (E.g. for an SEO/discoverability tool, drop "people search", "reverse image search", "excel data analysis", "python data analysis", "list crawlers" — these share "search"/"analysis" but are unrelated demand.)
- named events/conferences ("fomc meeting"), organization/person names, news queries, and pure dictionary lookups ("X meaning", "X defined").
Keep ONLY keywords a prospective buyer of a "${category}" product would search while looking to solve the problem. If after dropping there are too few left, return fewer themes rather than padding with off-category keywords.

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
  }, {
    // A `[]` here is an LLM failure / non-array parse — don't cache it for 30d.
    isEmpty: (themes) => themes.length === 0,
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

// ---------------------------------------------------------------------------
// demand_intel — read-through DB cache (a JSON-cache miss falls back to a
// fresher-than-TTL row before paying for a full gather). This is the ONE intel
// table that is genuinely read back; the write-only demand_pocket table (and the
// other 6 dead intel tables) were retired — the UI reads report_payload + caches.
// ---------------------------------------------------------------------------

const DEMAND_INTEL_TTL_MS = 7 * DAY_MS;

/**
 * True when a gathered/reassembled DemandIntel is degraded (both the keyword
 * table and the themes came back empty — the underlying keyword-ideas /
 * clustering calls failed or starved). Shared by every path that can put a
 * DemandIntel in front of a user or into a cache/table, so a poisoned payload
 * can neither be written NOR read back as valid:
 *   - the `demand-intel:*` cachedJson `isEmpty` option (skip the 7d cache write)
 *   - `persistDemandIntel` (skip the `demand_intel` table upsert)
 *   - `readDemandIntelFallback` (refuse to serve a previously-poisoned row)
 */
function isEmptyDemandIntel(intel: Pick<DemandIntel, "searchDemand">): boolean {
  return intel.searchDemand.themes.length === 0 && intel.searchDemand.topKeywords.length === 0;
}

/**
 * True when buyer insights carry no real signal (every list empty). Used ONLY on
 * the demand_intel read-back path (not the primary write/JSON-cache predicate): a
 * previously-cached row with blank buyer insights — e.g. written before the 2C
 * fallback source existed, when the competitor cohort had no minable reviews —
 * must NOT be served for the full 7-day TTL. Refusing it forces a fresh gather so
 * buyer insights repopulate from the subject's own reviews/community threads.
 * Deliberately narrow: keyword/theme/community data is left to govern caching, so
 * a rich payload is never thrown away just because buyer reviews were sparse.
 */
function buyerInsightsEmpty(bi: BuyerInsights): boolean {
  return (
    bi.pains.length === 0 &&
    bi.lovedFeatures.length === 0 &&
    bi.personas.length === 0 &&
    bi.buyerLanguage.length === 0
  );
}

/**
 * 2C — buyer insights derived from data ALREADY gathered (no extra LLM/API cost),
 * used only when competitor-review mining came back empty (indie rivals with no
 * G2/Capterra footprint). Grounded, not invented:
 *   - personas   ← the inferred ICP (who it's for) + the buyer audience
 *   - pains      ← the product's core problem + the ICP's jobs-to-be-done
 *   - language   ← verbatim titles of the highest-intent community threads buyers
 *                  actually posted (the real words they use)
 *   - lovedFeatures / sources are left empty: those genuinely require reviews, so
 *     we don't fabricate them.
 * Returns an empty payload when there's nothing to draw on — the UI then shows its
 * explicit empty state rather than a half-filled block.
 */
function fallbackBuyerInsights(brief: ProductDemandBrief, pockets: DemandPocket[]): BuyerInsights {
  const dedupe = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];
  const threadTitles = dedupe(
    pockets
      .flatMap((p) => p.topThreads)
      .sort((a, b) => b.intent - a.intent)
      .map((t) => t.title),
  ).slice(0, 6);
  return {
    pains: dedupe([brief.problem, ...brief.icp.jobsToBeDone]).slice(0, 6),
    lovedFeatures: [],
    personas: dedupe([brief.icp.whoItsFor, brief.audience]),
    buyerLanguage: threadTitles,
    sources: [],
  };
}

/**
 * Upsert the assembled DemandIntel into `demand_intel`.
 * Best-effort — any write error is logged and swallowed so it never breaks the
 * gather. Called via `void ...catch(...)` after a successful full gather.
 * Skips the write entirely when `intel` is empty by `isEmptyDemandIntel` —
 * otherwise a single degraded gather would blank the Demand page for every
 * reader until the row's 7-day TTL expires.
 */
async function persistDemandIntel(subject: string, cohortKey: string, intel: DemandIntel): Promise<void> {
  if (isEmptyDemandIntel(intel)) return;
  const db = serverDb();
  try {
    const { error } = await db.from("demand_intel").upsert(
      {
        subject_domain: subject,
        cohort_key: cohortKey,
        category: intel.category,
        icp: intel.icp as unknown as Json,
        search_demand: intel.searchDemand as unknown as Json,
        community: intel.community as unknown as Json,
        buyer_insights: intel.buyerInsights as unknown as Json,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "subject_domain,cohort_key" },
    );
    if (error) console.error(`[demand_intel] persist failed: ${error.message}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[demand_intel] persist failed: ${msg}`);
  }
}

/**
 * Read-through fallback for a JSON-cache miss: check the structured `demand_intel`
 * row before paying for a full gather. Returns null on absence, staleness (older
 * than the same TTL the JSON cache uses), or any read error — callers fall back to
 * the normal (expensive) gather in every one of those cases.
 */
async function readDemandIntelFallback(subject: string, cohortKey: string): Promise<DemandIntel | null> {
  try {
    const db = serverDb();
    const { data } = await db
      .from("demand_intel")
      .select("category, icp, search_demand, community, buyer_insights, fetched_at")
      .eq("subject_domain", subject)
      .eq("cohort_key", cohortKey)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.fetched_at).getTime() >= DEMAND_INTEL_TTL_MS) return null;
    if (!data.search_demand || !data.community || !data.buyer_insights || !data.icp) return null;
    const reassembled: DemandIntel = {
      domain: subject,
      category: data.category ?? "",
      icp: data.icp as unknown as ICP,
      searchDemand: data.search_demand as unknown as DemandIntel["searchDemand"],
      community: data.community as unknown as DemandIntel["community"],
      buyerInsights: data.buyer_insights as unknown as BuyerInsights,
    };
    // A previously-poisoned row (written before this predicate existed, or
    // written by a since-fixed-but-still-empty gather) must never satisfy a
    // read — same emptiness rule as the write path, so callers fall back to a
    // real gather instead of getting a blank Demand page for the full TTL.
    if (isEmptyDemandIntel(reassembled)) return null;
    // 1B — don't let a stale row with blank buyer insights blank the Customers tab
    // for the full TTL; fall back to a fresh gather (which uses the 2C fallback).
    if (buyerInsightsEmpty(reassembled.buyerInsights)) return null;
    return reassembled;
  } catch (err) {
    console.warn(`[demand_intel] fallback read failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function gatherDemand(rawSelf: string, opts: { competitorDomains?: string[]; onStage?: OnStageCallback } = {}): Promise<DemandIntel> {
  const self = normalizeHost(rawSelf);
  const cohortKey = (opts.competitorDomains ?? []).map((d) => d.toLowerCase()).sort().join(",");
  // Persist the assembled demand intel so repeat dashboard loads are instant.
  return cachedJson(`demand-intel:${self}:${cohortKey}`, DEMAND_INTEL_TTL_MS, async () => {
  // Read-through fallback: the JSON cache missed (expired/absent). Before paying for
  // a full gather, check the structured `demand_intel` table — a fresher-than-TTL
  // row (e.g. written by a sibling scan, or surviving a search_cache eviction) lets
  // us skip straight to reassembly. Returning it here also repopulates the JSON
  // cache, since cachedJson persists whatever this function returns.
  const fallback = await readDemandIntelFallback(self, cohortKey);
  if (fallback) return fallback;

  // Stages fired inside the cachedJson body — cold computes only; warm hits are instant.
  opts.onStage?.({ key: "demand:icp", label: "Understanding your buyers" });
  const brief = await inferProductBrief(self);
  // cohortKey is closed over from the outer scope.
  const competitors = (await cohortFor(self, opts.competitorDomains)).ranked.slice(0, MAX_SELECTED).map((r) => r.domain);

  // Compute the SEARCH SIGNALS (keyword demand + buyer pains) first — they seed the
  // Reddit community search so it finds many subreddits/threads per theme/pain.
  const [rawIdeas, buyerInsights] = await Promise.all([
    cachedKeywordIdeas(brief.seedKeywords),
    mineCompetitorReviews(competitors, brief.category),
  ]);

  // Keyword volume is now available; fire the stage with real total-addressable-volume.
  const totalRawVolume = rawIdeas.reduce((s, k) => s + k.volume, 0);
  opts.onStage?.({ key: "demand:keywords", label: "Sizing keyword demand", detail: `${totalRawVolume.toLocaleString()} monthly searches` });

  // Keep only ideas containing a DISTINCTIVE term (drops generic-SaaS + dictionary
  // noise like "preparation meaning"). But the model's coreTerms are often abstract
  // product concepts ("discoverability", "positioning") that match NONE of the
  // concrete keyword-demand vocabulary ("seo audit", "site checker") — filtering by
  // them alone can wipe the whole list and leave the Demand page blank. So degrade:
  // coreTerms → seed-derived tokens → unfiltered, never going below MIN_IDEAS.
  const MIN_IDEAS = 5;
  const filterBy = (toks: Set<string>) =>
    toks.size
      ? rawIdeas.filter((k) => { const kw = k.keyword.toLowerCase(); return [...toks].some((t) => kw.includes(t.toLowerCase())); })
      : rawIdeas;
  const seedTokens = topicTokens(brief.seedKeywords);
  let ideas = filterBy(brief.coreTerms.length ? new Set(brief.coreTerms) : seedTokens);
  if (ideas.length < MIN_IDEAS && seedTokens.size) ideas = filterBy(seedTokens);
  if (ideas.length < MIN_IDEAS) ideas = rawIdeas;

  const themes = await clusterKeywordThemes(ideas, brief.category);

  // Reddit community search grounded ONLY in the PRODUCT's own problem —
  // generatePainQueries derives product-specific pain queries broken into angles
  // (each tagged with its angle = the UI theme). We deliberately do NOT seed from
  // generic theme keywords or competitor-review pains: those drift off-topic to
  // unrelated category threads and lose the context of what THIS product does.
  const demand = await cachedJson(`demand:${self}:${cohortKey}`, 30 * DAY_MS, () =>
    discoverDemand({ brand: brief.brand, problem: brief.problem, audience: brief.audience, valueProp: brief.valueProp }, { queryCap: 10, maxHits: 80 }),
  );

  // Community pockets are now available — fire with real count.
  opts.onStage?.({ key: "demand:community", label: "Listening to communities", detail: `${demand.pockets.length} discussion${demand.pockets.length === 1 ? "" : "s"}` });
  // Reviews ran in parallel with keyword ideas above; fire as a final checkpoint.
  opts.onStage?.({ key: "demand:reviews", label: "Mining competitor reviews" });

  // Top-keywords table = only keywords the theme-clustering KEPT (it already drops
  // news/events/dictionary noise) minus navigational (competitor-brand) terms — so
  // the table reflects real buyer demand, not "fomc meeting"-style pollution.
  const themeKw = new Set(themes.flatMap((t) => t.sampleKeywords.map((k) => k.toLowerCase())));
  const cleaned = ideas.filter((k) => themeKw.has(k.keyword.toLowerCase()) && (k.intent ?? "").toLowerCase() !== "navigational");
  // The clustering LLM already dropped off-category / noise keywords, so derive BOTH
  // the table AND the addressable volume from the kept set — padding with raw ideas
  // would re-introduce the unrelated demand we just filtered out (and inflate volume).
  const onTopic = cleaned.length > 0 ? cleaned : ideas;
  const topKeywords = onTopic.slice(0, 25);

  // 2C — competitor reviews are often empty for indie rivals (no G2/Capterra
  // presence), which left the Customers tab blank. When so, fall back to buyer
  // signal we already hold — the inferred ICP + the real questions buyers ask in
  // the discovered community threads — instead of serving nothing.
  const effectiveBuyerInsights = buyerInsightsEmpty(buyerInsights)
    ? fallbackBuyerInsights(brief, demand.pockets)
    : buyerInsights;

  const result: DemandIntel = {
    domain: self,
    category: brief.category,
    icp: brief.icp,
    searchDemand: {
      totalAddressableVolume: onTopic.reduce((s, k) => s + k.volume, 0),
      topKeywords,
      themes,
    },
    community: { painQueries: demand.painQueries, pockets: demand.pockets },
    buyerInsights: effectiveBuyerInsights,
  };

  // Persist the assembled demand intel itself (best-effort, never blocks the return).
  // This is a live read-through cache (see readDemandIntelFallback) — NOT a dead
  // write — so it is retained. The demand_pocket table was write-only and retired.
  void persistDemandIntel(self, cohortKey, result).catch((err) =>
    console.error("[demand_intel] persist error:", err),
  );

  return result;
  }, {
    // If BOTH the keyword table and the themes came back empty, the underlying
    // keyword-ideas / clustering calls degraded — don't persist a blank demand
    // payload for 7d (it would blank the Demand page every load until TTL).
    isEmpty: isEmptyDemandIntel,
  });
}
