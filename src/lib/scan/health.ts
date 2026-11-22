// Every paid pass checks what it stored and keeps the answers on its own row (`scans.health`), so a bad number never reaches the screens unflagged:
// brand_volume   no rival's brand volume exceeds what the keywords its brand is read under hold (`brandKeywords`);
// market_terms   the market has at least one searched term with volume;
// mention_rate   the mention rate states its sample size and margin;
// serp_timeouts  no more than a fifth of the pass's SERP reads, AI Mode's included, timed out;
// knowledge_base the site's knowledge base holds at least one page.
// A failing check deletes nothing: it is listed in the Monday owner digest, and headline numbers are read from the last pass that had none.
// Pure: no I/O and no clock. `./health-record.ts` reads and writes.
import { brandKeywords } from "@/lib/market/infer/demand";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { measurePrompts, type PromptSample } from "@/lib/market/prompts/rate";

export const HEALTH_CHECKS = ["brand_volume", "market_terms", "mention_rate", "serp_timeouts", "knowledge_base"] as const;

/** The share of a pass's SERP reads that may time out. More fails. */
export const SERP_TIMEOUT_SHARE = 0.2;

/** A pass's SERP reads as the ledger holds them: every read that reached
 *  the vendor, a second ask of one search included, and how many of them
 *  met our own request bound. An answer served from the cache is no read. */
export interface SerpReads {
  reads: number;
  timeouts: number;
}
export type HealthCheck = (typeof HEALTH_CHECKS)[number];

export interface HealthResult {
  check: HealthCheck;
  pass: boolean;
  /** One line for the owner: what was found. Never shown to a customer. */
  detail: string;
  /** What failed, one entry each: a rival, a prompt. Empty on a pass. */
  items: readonly string[];
}

export interface ScanHealth {
  /** When the checks ran, ISO. */
  at: string;
  checks: readonly HealthResult[];
}

/** The checks that failed. None on a row no check has run on. */
export function failingChecks(health: ScanHealth | null): readonly HealthResult[] {
  return health === null ? [] : health.checks.filter((result) => !result.pass);
}

const result = (check: HealthCheck, items: readonly string[], detail: string): HealthResult => ({
  check,
  pass: items.length === 0,
  detail,
  items,
});

/** A rival whose stored volume is more than the keywords its brand is read
 *  under hold: it was read under a name that mostly means something else. */
function brandVolume(market: MarketConclusion | null): HealthResult {
  const demand = market?.demand;
  if (market === null || demand === undefined) return result("brand_volume", [], "no brand volume was read");
  const polluted: string[] = [];
  for (const rival of market.rivals) {
    if (rival.volume === undefined) continue;
    const keywords = brandKeywords(rival);
    const read = Math.max(0, ...keywords.map((keyword) => demand.brands[keyword] ?? 0));
    if (rival.volume > read) polluted.push(`${rival.name}: stored ${rival.volume}, "${keywords.join('", "')}" has ${read}`);
  }
  return result(
    "brand_volume",
    polluted,
    polluted.length === 0 ? `${market.rivals.length} rivals read under their own keywords` : `${polluted.length} of ${market.rivals.length} rivals polluted`
  );
}

function marketTerms(market: MarketConclusion | null): HealthResult {
  const searched = (market?.terms ?? []).filter((term) => term.volume > 0 && term.polluted !== true);
  const best = searched[0];
  return best === undefined
    ? result("market_terms", ["no searched term"], "the market has no searched term with volume")
    : result("market_terms", [], `${searched.length} searched terms; "${best.term}" has ${best.volume}`);
}

/** The rate as the screens state it from this pass's own answers. A pass
 *  that asks no prompts states no rate, and that is not a failure. */
function mentionRate(samples: readonly PromptSample[] | null): HealthResult {
  if (samples === null) return result("mention_rate", [], "this pass asked no prompts");
  const rate = measurePrompts(samples).rate;
  const stated =
    rate !== null && rate.samples > 0 && [rate.low, rate.high].every(Number.isFinite) && rate.low <= rate.rate && rate.rate <= rate.high;
  if (rate === null || !stated) return result("mention_rate", ["no sample"], "no unbranded answer was read: no sample and no margin to state");
  const percent = (fraction: number): number => Math.round(fraction * 100);
  return result(
    "mention_rate",
    [],
    `${rate.linked + rate.named} of ${rate.samples} answers, ${percent(rate.low)}–${percent(rate.high)}%`
  );
}

/** A pass that lost more than a fifth of its SERP reads to the clock holds
 *  that much less of its top tens. Reads that could not be counted, and a
 *  pass that made none, fail nothing. */
function serpTimeouts(serp: SerpReads | null | undefined): HealthResult {
  if (serp === null || serp === undefined) return result("serp_timeouts", [], "the SERP reads were not counted");
  if (serp.reads === 0) return result("serp_timeouts", [], "this pass made no SERP read");
  const found = `${serp.timeouts} of ${serp.reads} SERP reads timed out`;
  return result("serp_timeouts", serp.timeouts / serp.reads > SERP_TIMEOUT_SHARE ? [found] : [], found);
}

/** A site whose knowledge base holds no page has nothing its topics are judged against or its pages written from. An unreadable count fails nothing. */
function knowledgeBase(pages: number | null | undefined): HealthResult {
  if (pages === null || pages === undefined) return result("knowledge_base", [], "the knowledge base was not counted");
  return pages === 0
    ? result("knowledge_base", ["no page read"], "the knowledge base holds no page of the site")
    : result("knowledge_base", [], `the knowledge base holds ${pages} ${pages === 1 ? "page" : "pages"}`);
}

export interface HealthInput {
  /** The market in force when the pass ended. */
  market: MarketConclusion | null;
  /** The pass's answers as samples; `null` where the pass asks no prompts. */
  samples: readonly PromptSample[] | null;
  /** The pass's SERP reads; `null` where the ledger could not be read. */
  serp?: SerpReads | null;
  /** How many of the site's pages its knowledge base holds; `null` where
   *  it could not be read. */
  knowledgePages?: number | null;
  at: Date;
}

export function checkHealth(a: HealthInput): ScanHealth {
  return {
    at: a.at.toISOString(),
    checks: [brandVolume(a.market), marketTerms(a.market), mentionRate(a.samples), serpTimeouts(a.serp), knowledgeBase(a.knowledgePages)],
  };
}

/** `scans.health` read back. `null` on a row no check ran on, or whose
 *  value this build does not recognise: such a pass is not called unhealthy. */
export function parseHealth(value: unknown): ScanHealth | null {
  if (typeof value !== "object" || value === null) return null;
  const { at, checks } = value as { at?: unknown; checks?: unknown };
  if (typeof at !== "string" || !Array.isArray(checks)) return null;
  const read: HealthResult[] = [];
  for (const entry of checks as unknown[]) {
    const each = entry as Partial<HealthResult> | null;
    if (each === null || typeof each !== "object" || !HEALTH_CHECKS.includes(each.check as HealthCheck) || typeof each.pass !== "boolean") continue;
    read.push({
      check: each.check as HealthCheck,
      pass: each.pass,
      detail: typeof each.detail === "string" ? each.detail : "",
      items: Array.isArray(each.items) ? each.items.filter((item): item is string => typeof item === "string") : [],
    });
  }
  return { at, checks: read };
}
