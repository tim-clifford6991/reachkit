/**
 * Category-search grounded, size-banded competitor discovery — the validated
 * pipeline, extracted so both the dev preview and the dashboard intel share one
 * source of truth.
 *
 * infer micro-category (LLM) → search THAT category (Tavily) → keep same-category
 * domains from REAL result URLs → size-band (drop dead + category giants, target
 * the subject's stage) → LLM selects same-category from the band. Falls back to
 * model knowledge only if grounding yields <2.
 */
import { tavilySearch } from "@/lib/scan/adapters/tavily";
import { hostname } from "@/lib/scan/url";
import { normalizeHost, isNoiseHost } from "@/lib/scan/referral/classify";
import { fetchTrafficForHosts } from "@/lib/scan/adapters/dataforseo-traffic";
import {
  inferCategoryAndQueries,
  selectCompetitorsFromCandidates,
  llmCompetitorDomains,
  rankClosestCompetitors,
  type RankedCompetitor,
} from "@/lib/scan/referral/llm-competitors";

export type TraceStatus = "ok" | "empty" | "error" | "skipped";
export interface TraceStep {
  node: string;
  status: TraceStatus;
  ms: number;
  input?: unknown;
  output?: unknown;
  note?: string;
}

export function productNameFromHost(host: string): string {
  const label = host.replace(/^www\./, "").split(".")[0] || host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const uniq = (xs: string[]) => [...new Set(xs)];

const CANDIDATE_AGGREGATORS = new Set([
  "g2.com", "capterra.com", "getapp.com", "softwareadvice.com", "producthunt.com",
  "alternativeto.net", "saashub.com", "trustpilot.com", "slashdot.org", "sourceforge.net",
  "appsumo.com", "betalist.com", "youtube.com", "medium.com", "linkedin.com", "reddit.com",
]);

/** App stores / extension stores / generic platforms — never a competitor product.
 *  (e.g. apps.apple.com surfaced for Nudge AI — always remove.) */
const JUNK_HOSTS = new Set([
  "apps.apple.com", "play.google.com", "chromewebstore.google.com", "chrome.google.com",
  "addons.mozilla.org", "apps.microsoft.com", "apps.shopify.com", "marketplace.atlassian.com",
  "workspace.google.com", "microsoftedge.microsoft.com", "itunes.apple.com",
]);
const isJunkHost = (h: string): boolean => JUNK_HOSTS.has(h) || /^(apps|play|store|chromewebstore|addons|marketplace)\./.test(h);

const SIZE_FLOOR = 500; // below this: no real backlink profile to intersect
const SIZE_CEILING_DEFAULT = 200_000; // above this (for a small subject): a "giant"

export interface DiscoverCompetitorsResult {
  domains: string[];
  category: string;
}

/** Discover up to 3 size-comparable, same-category competitor domains. Pushes
 *  progress to `trace` when provided. Never throws (degrades to fewer competitors). */
export async function discoverCompetitors(self: string, trace: TraceStep[] = []): Promise<DiscoverCompetitorsResult> {
  const productName = productNameFromHost(self);

  let t = Date.now();
  const cat = await inferCategoryAndQueries({ productName, host: self });
  trace.push({
    node: "competitor.infer_category",
    status: cat.category ? "ok" : "empty",
    ms: Date.now() - t,
    input: { model: "claude-haiku-4-5", homepageBlurb: cat.blurb || "(none fetched)" },
    output: { category: cat.category, queries: cat.queries, tokensIn: cat.tokensIn, tokensOut: cat.tokensOut },
  });

  let candidates: { domain: string; title: string }[] = [];
  if (cat.queries.length) {
    t = Date.now();
    const resultSets = await Promise.all(cat.queries.slice(0, 2).map((q) => tavilySearch(q, { maxResults: 10 })));
    const byDomain = new Map<string, string>();
    for (const rs of resultSets) {
      for (const r of rs) {
        const d = normalizeHost(hostname(r.url || ""));
        if (!d || d === self || isNoiseHost(d) || CANDIDATE_AGGREGATORS.has(d)) continue;
        if (!byDomain.has(d)) byDomain.set(d, r.title || d);
      }
    }
    candidates = [...byDomain.entries()].map(([domain, title]) => ({ domain, title })).slice(0, 25);
    trace.push({
      node: "competitor.category_search",
      status: candidates.length ? "ok" : "empty",
      ms: Date.now() - t,
      input: { source: "Tavily", queries: cat.queries.slice(0, 2) },
      output: { candidateDomains: candidates.map((c) => c.domain) },
    });
  }

  let domains: string[] = [];
  const category = cat.category;
  if (candidates.length) {
    t = Date.now();
    const traffic = await fetchTrafficForHosts([self, ...candidates.map((c) => c.domain)]);
    const subjectTraffic = traffic.get(self) ?? 0;
    const ceiling = subjectTraffic > 5000 ? subjectTraffic * 8 : SIZE_CEILING_DEFAULT;
    const withEtv = candidates.map((c) => ({ ...c, etv: traffic.get(c.domain) ?? 0 }));
    let banded = withEtv.filter((c) => c.etv >= SIZE_FLOOR && c.etv <= ceiling);
    let relaxed = false;
    if (banded.length < 2) {
      banded = withEtv.filter((c) => c.etv >= SIZE_FLOOR);
      relaxed = true;
    }
    trace.push({
      node: "competitor.size_band",
      status: banded.length >= 2 ? "ok" : "empty",
      ms: Date.now() - t,
      input: { subjectTraffic, sizeFloor: SIZE_FLOOR, sizeCeiling: ceiling, logic: "keep competitors comparable to the subject's stage; drop dead (<floor) and category giants (>ceiling)" },
      output: {
        kept: banded.map((c) => ({ domain: c.domain, etv: Math.round(c.etv) })),
        droppedGiants: withEtv.filter((c) => c.etv > ceiling).map((c) => `${c.domain} (${Math.round(c.etv)})`),
        relaxed,
      },
      note: relaxed ? "No size-comparable competitors found — kept larger players; opportunities will be broad/less actionable." : undefined,
    });

    if (banded.length) {
      t = Date.now();
      const sel = await selectCompetitorsFromCandidates({ productName, host: self, category, candidates: banded.map((c) => ({ domain: c.domain, title: c.title })) });
      const etvOf = (d: string) => banded.find((c) => c.domain === d)?.etv ?? 0;
      domains = uniq(sel.competitors.map((c) => c.domain).filter((d) => d && d !== self))
        .sort((a, b) => etvOf(b) - etvOf(a))
        .slice(0, 3);
      trace.push({
        node: "competitor.select_from_category",
        status: domains.length ? "ok" : "empty",
        ms: Date.now() - t,
        input: { model: "claude-haiku-4-5", category, bandedCount: banded.length },
        output: { selected: domains, llmReturned: sel.competitors, tokensIn: sel.tokensIn, tokensOut: sel.tokensOut },
      });
    }
  }

  if (domains.length < 2) {
    t = Date.now();
    const llm = await llmCompetitorDomains({ productName, host: self });
    const llmDomains = llm.competitors.map((c) => c.domain).filter((d) => d && d !== self);
    trace.push({
      node: "competitor.knowledge_fallback",
      status: llm.competitors.length ? "ok" : "empty",
      ms: Date.now() - t,
      input: { model: "claude-haiku-4-5", inferredCategory: llm.category, reason: "category-grounding < 2 competitors" },
      output: { competitors: llm.competitors, tokensIn: llm.tokensIn, tokensOut: llm.tokensOut },
    });
    domains = uniq([...domains, ...llmDomains]);
  }

  return { domains: domains.slice(0, 3), category };
}

// ---------------------------------------------------------------------------
// CLOSEST competitors — for the "top competitors to learn from" list. Distinct
// from discoverCompetitors (size-banded referral cohort): this keeps the strongest
// DIRECT rivals even if larger, ranked by closeness to the subject's offering.
// ---------------------------------------------------------------------------

export interface RankedCandidate extends RankedCompetitor {
  etv: number;
  /** competitor ETV ÷ subject ETV. null when the subject has no measurable traffic. */
  ratio: number | null;
  /** false when far larger than the subject (>SIZE_RATIO_CAP×) and the subject has real traffic. */
  sizeRelevant: boolean;
}

export interface ClosestCompetitorsResult {
  category: string;
  blurb: string;
  /** The subject's own estimated organic traffic (for size comparison). */
  subjectEtv: number;
  /** LLM closeness ranking (≥3), enriched with traffic + size ratio, closest first. */
  ranked: RankedCandidate[];
  /** Suggested default set: closeness-ranked, alive, size-relevant — but the USER picks. */
  suggested: string[];
}

const ALIVE_FLOOR = 100; // drop parked/dead domains, but keep small real rivals
const SIZE_RATIO_CAP = 50; // >50× the subject's traffic → likely not a benchmarkable peer
const SIZE_BASELINE = 1000; // below this the subject's traffic is too small to compute a ratio

export async function discoverClosestCompetitors(self: string, trace: TraceStep[] = []): Promise<ClosestCompetitorsResult> {
  const productName = productNameFromHost(self);

  let t = Date.now();
  const cat = await inferCategoryAndQueries({ productName, host: self });
  trace.push({
    node: "closest.infer_category",
    status: cat.category ? "ok" : "empty",
    ms: Date.now() - t,
    input: { model: "claude-haiku-4-5", homepageBlurb: cat.blurb || "(none fetched)" },
    output: { category: cat.category, queries: cat.queries },
  });

  // Richer pool: up to 3 category queries.
  let candidates: { domain: string; title: string }[] = [];
  if (cat.queries.length) {
    t = Date.now();
    const resultSets = await Promise.all(cat.queries.slice(0, 3).map((q) => tavilySearch(q, { maxResults: 10 })));
    const byDomain = new Map<string, string>();
    for (const rs of resultSets) {
      for (const r of rs) {
        const d = normalizeHost(hostname(r.url || ""));
        if (!d || d === self || isNoiseHost(d) || CANDIDATE_AGGREGATORS.has(d) || isJunkHost(d)) continue;
        if (!byDomain.has(d)) byDomain.set(d, r.title || d);
      }
    }
    candidates = [...byDomain.entries()].map(([domain, title]) => ({ domain, title })).slice(0, 30);
    trace.push({ node: "closest.category_search", status: candidates.length ? "ok" : "empty", ms: Date.now() - t, input: { queries: cat.queries.slice(0, 3) }, output: { candidateDomains: candidates.map((c) => c.domain) } });
  }

  // Traffic for the subject + candidates (size comparison + liveness).
  const traffic = await fetchTrafficForHosts([self, ...candidates.map((c) => c.domain)]);
  const subjectEtv = traffic.get(self) ?? 0;
  const hasSubjectSize = subjectEtv >= SIZE_BASELINE;

  // Closeness ranking.
  t = Date.now();
  const cl = await rankClosestCompetitors({ productName, host: self, blurb: cat.blurb, category: cat.category, candidates });
  const ranked: RankedCandidate[] = cl.ranked
    .map((r) => {
      const etv = traffic.get(r.domain) ?? 0;
      const ratio = hasSubjectSize ? etv / subjectEtv : null;
      const sizeRelevant = ratio == null ? true : ratio <= SIZE_RATIO_CAP;
      return { ...r, etv, ratio, sizeRelevant };
    })
    .filter((r) => r.closeness >= 3 && r.etv >= ALIVE_FLOOR && !isJunkHost(r.domain));

  trace.push({
    node: "closest.rank",
    status: ranked.length ? "ok" : "empty",
    ms: Date.now() - t,
    input: { model: "claude-haiku-4-5", candidateCount: candidates.length, subjectEtv: Math.round(subjectEtv) },
    output: { ranked: ranked.map((r) => ({ domain: r.domain, closeness: r.closeness, etv: Math.round(r.etv), ratio: r.ratio ? Math.round(r.ratio * 10) / 10 : null, sizeRelevant: r.sizeRelevant, reason: r.reason })), tokensIn: cl.tokensIn, tokensOut: cl.tokensOut },
  });

  // Suggested default = closest + size-relevant; the user can override.
  const suggested = ranked.filter((r) => r.sizeRelevant).map((r) => r.domain).slice(0, 5);

  return { category: cat.category, blurb: cat.blurb, subjectEtv, ranked, suggested };
}
