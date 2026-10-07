// src/lib/scan/health.ts — every measurement checks its own health (SPEC
// §6, owner D58 of 2026-10-06, issue 1287).
//
// Scan 17f5bbff stored a rival read at 22,200 searches for a first name and
// asked five prompts about rivals the same pass dropped, and nothing said
// so: the numbers went to the screens as they were. So a paid pass ends by
// asking six questions of what it stored, and keeps the answers on its own
// row (`scans.health`):
//
//   brand_volume   no rival's brand volume is polluted — none is larger
//                  than what the keywords its brand is read under hold
//                  (issue 1285's `brandKeywords`);
//   prompt_rivals  every tracked prompt names only current rivals;
//   market_terms   the market has at least one searched term with volume;
//   mention_rate   the mention rate states its sample size and margin;
//   serp_timeouts  no more than a fifth of the pass's SERP reads timed out
//                  (owner D63 of 2026-10-07, issue 1298), Google's AI Mode
//                  reads among them (issue 1314);
//   knowledge_base the site's knowledge base holds at least one page
//                  (2026-10-07, issue 1314).
//
// A failing check deletes nothing. It is listed in the Monday owner digest,
// and the headline numbers are read from the last pass that had none
// (`./weekly/prompts.ts`).
//
// Pure: no I/O and no clock of its own. `./health-record.ts` reads and
// writes.
import { brandKeywords } from "@/lib/market/infer/demand";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type { GeneratedPrompt, PromptKind } from "@/lib/market/prompts/generate";
import { measurePrompts, type PromptSample } from "@/lib/market/prompts/rate";
import { followRivals } from "@/lib/market/prompts/set";

export const HEALTH_CHECKS = ["brand_volume", "prompt_rivals", "market_terms", "mention_rate", "serp_timeouts", "knowledge_base"] as const;

/** D63: the share of a pass's SERP reads that may time out. More fails. */
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

const key = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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

/** The products a pass read as rival candidates and did not keep, as the
 *  keyword each was read under. */
export function formerRivals(market: MarketConclusion, own: readonly string[] = []): string[] {
  const held = new Set(
    market.rivals.flatMap((rival) => [rival.name, rival.domain.split(".")[0] ?? "", ...(rival.searchNames ?? []), ...brandKeywords(rival)].map(key))
  );
  const mine = new Set(own.map(key));
  return Object.keys(market.demand?.brands ?? {})
    .map(key)
    .filter((brand) => brand.length > 2 && !held.has(brand) && !mine.has(brand));
}

/** Whether `text` names one of `brands`, as a word of its own. */
export function namesAny(text: string, brands: readonly string[]): boolean {
  const padded = ` ${key(text)} `;
  return brands.some((brand) => padded.includes(` ${brand} `));
}

/** The prompts that name a rival that is not current: a comparison or
 *  branded prompt today's rivals do not yield (issue 1285's `followRivals`),
 *  and any prompt that names a product a pass read and did not keep. */
const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Does this prompt name only rivals in force? (SPEC §6, owner D64, issue
 * 1301.) The comparison and branded prompts are built from the rivals in
 * demand order, and a pass re-orders its rivals after it has asked them:
 * "Profound or Otterly: which is the better choice…" named two current
 * rivals and was flagged because the set now began "Otterly or Omniscient".
 * So the order is not read. A prompt passes where it is one the rivals in
 * force yield, in any of the places a rival's name takes, and every name it
 * puts there is a current rival's.
 */
function namesCurrentRivals(
  prompt: { kind: PromptKind; text: string },
  generated: readonly GeneratedPrompt[],
  rivals: readonly string[]
): boolean {
  const current = new Set(rivals.map(key));
  const names = [...rivals].sort((x, y) => y.length - x.length).map(literal);
  if (names.length === 0) return false;
  const anyRival = new RegExp(`\\b(?:${names.join("|")})\\b`, "g");
  for (const yielded of generated) {
    if (yielded.kind !== prompt.kind) continue;
    const parts = yielded.text.split(anyRival);
    if (parts.length === 1) continue;
    const shape = new RegExp(`^${parts.map(literal).join("(.+?)")}$`, "i");
    const named = shape.exec(prompt.text);
    if (named !== null && named.slice(1).every((name) => current.has(key(name)))) return true;
  }
  return false;
}

function promptRivals(a: Pick<HealthInput, "market" | "asked" | "generated" | "ownNames" | "at">): HealthResult {
  if (a.asked.length === 0) return result("prompt_rivals", [], "no tracked prompts");
  const stored = { prompts: a.asked.map((prompt) => ({ ...prompt, addedAt: "" })), rotations: [] };
  const followed = new Set(followRivals(stored, a.generated, a.at).prompts.map((prompt) => prompt.id));
  const former = a.market === null ? [] : formerRivals(a.market, a.ownNames);
  const rivals = (a.market?.rivals ?? []).map((rival) => rival.name);
  const stale = a.asked.filter(
    (prompt) => (!followed.has(prompt.id) && !namesCurrentRivals(prompt, a.generated, rivals)) || namesAny(prompt.text, former)
  );
  return result(
    "prompt_rivals",
    stale.map((prompt) => prompt.text),
    stale.length === 0 ? `${a.asked.length} prompts name only current rivals` : `${stale.length} of ${a.asked.length} prompts name a rival that is not current`
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

/** A site whose knowledge base holds no page has nothing its topics are
 *  judged against or its pages written from (issue 1314). A count that
 *  could not be read fails nothing. */
function knowledgeBase(pages: number | null | undefined): HealthResult {
  if (pages === null || pages === undefined) return result("knowledge_base", [], "the knowledge base was not counted");
  return pages === 0
    ? result("knowledge_base", ["no page read"], "the knowledge base holds no page of the site")
    : result("knowledge_base", [], `the knowledge base holds ${pages} ${pages === 1 ? "page" : "pages"}`);
}

export interface HealthInput {
  /** The market in force when the pass ended. */
  market: MarketConclusion | null;
  /** The business's own brand keywords, never a rival's. */
  ownNames?: readonly string[];
  /** The prompts the pass asked; where it asked none, the stored set. */
  asked: readonly { id: string; kind: PromptKind; text: string }[];
  /** What the market in force yields (`generatePrompts`). */
  generated: readonly GeneratedPrompt[];
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
    checks: [brandVolume(a.market), promptRivals(a), marketTerms(a.market), mentionRate(a.samples), serpTimeouts(a.serp), knowledgeBase(a.knowledgePages)],
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
