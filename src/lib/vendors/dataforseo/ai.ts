// BUILD §6.2 — aiMode and llmScraper: the paid battery's two AI-answer engines
// The ChatGPT scraper has no live variant, so its type admits none.
// Paid battery only (§6.2/§6.3): no type tells a free `CostContext` from a paid one, so each reads `c.cap` and under `FREE`
// returns `unmeasured / not_attempted` without reaching the vendor (§6.5: caps degrade, never throw).
// `CACHE_WINDOWS_D.aiBattery` is six days, not seven, because the weekly trigger can land early and must not get last week's answer.
// The key carries whose purchase it is (`CacheScope`), so customers sharing a search do not share a bill.
// No answer is the vendor's zero-result `[]`, never cached (§6.4), and surfaces as `answered: false`.
import type { CostContext } from "@/lib/costs";
import { CACHE_WINDOWS_D, PRICE_BOOK } from "@/lib/config/constants";
import type { Locale } from "@/lib/locale/locales";
import { mapMeasured, unmeasured, type Measured } from "@/lib/measure/measured";
import {
  asArray,
  asString,
  callEndpoint,
  collectTask,
  isRecord,
  ledgered,
  referenceDomains,
  referenceUrls,
  type EndpointPaths,
  type OnVendorFailure,
} from "./envelope";
import { localeCacheKey, placeCacheKey, type DataForSeoMode } from "./transport";
import { AI_ANSWER_SOURCES, scopeKey, type AiAnswer, type CacheScope } from "./types";

const NO_ANSWER: AiAnswer = { answered: false, text: "", citedDomains: [] };

const AI_MODE = "/v3/serp/google/ai_mode";
const AI_MODE_PATHS: EndpointPaths = {
  live: `${AI_MODE}/live/advanced`,
  std: { taskPost: `${AI_MODE}/task_post`, taskGet: (id) => `${AI_MODE}/task_get/advanced/${encodeURIComponent(id)}` },
};

const LLM_SCRAPER = "/v3/ai_optimization/chat_gpt/llm_scraper";
const LLM_SCRAPER_PATHS: EndpointPaths = {
  std: { taskPost: `${LLM_SCRAPER}/task_post`, taskGet: (id) => `${LLM_SCRAPER}/task_get/advanced/${encodeURIComponent(id)}` },
};

/** Google AI Mode returns its answer as one `ai_overview` item with
 *  `markdown` and `references` (same shape as the organic SERP's overview). */
export function parseAiMode(result: unknown): AiAnswer[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  for (const item of result.items) {
    if (!isRecord(item) || item.type !== "ai_overview") continue;
    const cited = new Set<string>(referenceDomains(item.references));
    const urls = new Set<string>(referenceUrls(item.references));
    for (const element of asArray(item.items)) {
      if (!isRecord(element)) continue;
      for (const d of referenceDomains(element.references)) cited.add(d);
      for (const u of referenceUrls(element.references)) urls.add(u);
    }
    const text = asString(item.markdown) ?? asString(item.text) ?? "";
    if (!text && cited.size === 0) return [];
    return [{ answered: true, text, citedDomains: [...cited], citedUrls: [...urls] }];
  }
  return [];
}

/** Caps on what a stored ChatGPT answer keeps of its searches and reads, so each payload grows by about 2 KB at most. */
export const AI_FAN_OUTS_MAX = 8;
export const AI_RETRIEVED_MAX = 20;

/** Absent where the vendor sent no list, so an older or search-less answer stays "not measured", never "none". */
function searchedAndRead(item: Record<string, unknown>): Pick<AiAnswer, "fanOuts" | "retrievedUrls"> {
  const fanOuts = Array.isArray(item.fan_out_queries)
    ? [...new Set(item.fan_out_queries.flatMap((q) => asString(q)?.trim() || []))].slice(0, AI_FAN_OUTS_MAX)
    : undefined;
  const retrievedUrls = Array.isArray(item.search_results) ? referenceUrls(item.search_results).slice(0, AI_RETRIEVED_MAX) : undefined;
  return { ...(fanOuts ? { fanOuts } : {}), ...(retrievedUrls ? { retrievedUrls } : {}) };
}

/** The ChatGPT scraper's result: an item carrying `markdown` and `sources`
 *  — "the sources the model actually cited or relied on in its final
 *  answer" — which is what counts as a citation; `search_results` (what
 *  it retrieved, cited or not) never does, and is kept apart as `retrievedUrls`. */
export function parseLlmScraper(result: unknown): AiAnswer[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const text = asString(item.markdown) ?? asString(item.text);
    const cited = referenceDomains(item.sources);
    if (!text && cited.length === 0) continue;
    return [{ answered: true, text: text ?? "", citedDomains: cited, citedUrls: referenceUrls(item.sources), ...searchedAndRead(item) }];
  }
  return [];
}

export { AI_ANSWER_SOURCES };

/** What reading a paid, queued ask again came to: the rows the
 *  first call would have stored (none for the engine's own no-answer), a
 *  task still not ready, or a failure that reading again will not change. */
export type CollectedAnswer =
  | { readonly kind: "answer"; readonly rows: AiAnswer[] }
  | { readonly kind: "pending" }
  | { readonly kind: "failed"; readonly failure: string };

/**
 * Reads the answer to an ask an earlier pass posted, paid for and stopped
 * waiting on. Free: nothing is posted. It waits until `untilMs`.
 */
export async function collectAiAnswer(a: {
  engine: keyof typeof AI_ANSWER_SOURCES;
  taskId: string;
  untilMs: number;
}): Promise<CollectedAnswer> {
  const out = await collectTask(a.engine === "chatgpt" ? LLM_SCRAPER_PATHS : AI_MODE_PATHS, a.taskId, a.untilMs);
  if (!out.ok) return out.taskId === undefined ? { kind: "failed", failure: out.failure } : { kind: "pending" };
  if (out.noResults === true) return { kind: "answer", rows: [] };
  const rows = (a.engine === "chatgpt" ? parseLlmScraper : parseAiMode)(out.result);
  return rows === undefined ? { kind: "failed", failure: "unparseable" } : { kind: "answer", rows };
}

function runKey(run: number | undefined, asOf?: string): string {
  return `${asOf === undefined ? "" : `|asof:${asOf}`}${run === undefined || run <= 1 ? "" : `|run:${run}`}`;
}

function paidOnly<T>(c: CostContext, at: Date): Measured<T> | undefined {
  return c.cap === "FREE" ? unmeasured<T>("not_attempted", at) : undefined;
}

export async function aiMode(
  c: CostContext,
  a: {
    query: string;
    mode: DataForSeoMode;
    scope: CacheScope;
    /** The site's country and language (D66): where the read is made, and
     *  part of its cache key. */
    locale: Locale;
    /** Where the battery hears why a call failed, so a pass can
     *  stop buying an engine that is refusing and say on the cell what it
     *  was told. */
    onFailure?: OnVendorFailure;
    /** Which ask of the same query this is, 1-based (D19): a second ask under the first's key would get the first's
     *  answer. Absent and 1 share a key. */
    run?: number;
    /** The day the sample belongs to, `YYYY-MM-DD`: a tracked
     *  prompt is a fresh sample each pass day, never last week's answer
     *  served again inside the battery's cache window. */
    asOf?: string;
    /** When the caller's own ceiling runs out, as epoch milliseconds. Without it the standard queue's poll runs to
     *  `VENDOR.stdQueueDeadlineMin` inside one call, out of reach of a pass's between-calls check. */
    untilMs?: number;
    /** The wall clock one request may hold (D63): AI Mode's live read often outlasts the transport's 10 s bound, and
     *  each timeout is billed. Absent, the transport's own bound. */
    abortMs?: number;
  }
): Promise<Measured<AiAnswer>> {
  const refused = paidOnly<AiAnswer>(c, new Date());
  if (refused) return refused;
  const rows = await ledgered<AiAnswer>(c, {
    source: AI_ANSWER_SOURCES.ai_mode,
    cacheKey: `${a.query}|${placeCacheKey(a.locale)}|${scopeKey(a.scope)}${runKey(a.run, a.asOf)}`,
    freshnessDays: CACHE_WINDOWS_D.aiBattery,
    costCents: a.mode === "live" ? PRICE_BOOK.AI_MODE_LIVE_C : PRICE_BOOK.AI_MODE_STD_C,
    fetch: () => callEndpoint(AI_MODE_PATHS, a.mode, a.locale, { keyword: a.query }, a.abortMs, a.untilMs),
    parse: parseAiMode,
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
  });
  return mapMeasured(rows, (r) => r[0] ?? NO_ANSWER);
}

export async function llmScraper(
  c: CostContext,
  a: { query: string; mode: "std"; scope: CacheScope; locale: Locale; onFailure?: OnVendorFailure; untilMs?: number; run?: number; asOf?: string }
): Promise<Measured<AiAnswer>> {
  const refused = paidOnly<AiAnswer>(c, new Date());
  if (refused) return refused;
  const rows = await ledgered<AiAnswer>(c, {
    source: AI_ANSWER_SOURCES.chatgpt,
    cacheKey: `${a.query}|${localeCacheKey(a.locale)}|${scopeKey(a.scope)}${runKey(a.run, a.asOf)}`,
    freshnessDays: CACHE_WINDOWS_D.aiBattery,
    costCents: PRICE_BOOK.CHATGPT_SCRAPE_STD_C,
    fetch: () => callEndpoint(LLM_SCRAPER_PATHS, a.mode, a.locale, { keyword: a.query }, undefined, a.untilMs),
    parse: parseLlmScraper,
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
  });
  return mapMeasured(rows, (r) => r[0] ?? NO_ANSWER);
}
