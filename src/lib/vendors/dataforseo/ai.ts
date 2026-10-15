// BUILD §6.2 — aiMode and llmScraper: the paid battery's two AI-answer engines (issue #23)
//
// Google AI Mode (its own SERP endpoint, live or standard) and the ChatGPT
// LLM Scraper (standard queue only — there is no live variant to call, so
// the type admits none). Both are **paid battery only**: §6.2/§6.3 rule the
// free path makes zero AI Optimization calls, and no compile-time shape can
// tell a free `CostContext` from a paid one, so each reads `c.cap` and under
// `FREE` returns `unmeasured / not_attempted` without reaching the vendor —
// a refusal, not a throw (§6.5: caps degrade, never throw).
//
// Prices are the §6.1 pins for the mode used.
//
// **Cache: `CACHE_WINDOWS_D.aiBattery`, a window that names the battery**
// (#75). These two calls used to pass `.own` — 7 days, and `own` means
// "the customer's own domain", so the citation was wrong even where the
// number was arguable. §6.4 names no window for the battery, so the pin is
// chosen at `constants.ts` and read here; it is six days rather than seven
// because the battery is re-measured weekly on a trigger that can land an
// hour early (ADR-060), and at seven a run that did would be served last
// week's answer as this week's measurement.
//
// **The key carries whose purchase it is** (#75). Query and locale alone
// are shared across every customer whose market contains that search,
// which `DATA-COSTS.md` §5's "monthly per customer" roll-up already
// assumed they were not — see `CacheScope`.
//
// An engine that gave no answer is the vendor's own zero-result — `[]`,
// never cached (§6.4: no negative cache) — and surfaces as the `zero` arm
// carrying `answered: false`.
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

/** The ChatGPT scraper's result: an item carrying `markdown` and `sources`
 *  — "the sources the model actually cited or relied on in its final
 *  answer" — which is what counts as a citation; `search_results` (what
 *  it retrieved, cited or not) deliberately does not. */
export function parseLlmScraper(result: unknown): AiAnswer[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const text = asString(item.markdown) ?? asString(item.text);
    const cited = referenceDomains(item.sources);
    if (!text && cited.length === 0) continue;
    return [{ answered: true, text: text ?? "", citedDomains: cited, citedUrls: referenceUrls(item.sources) }];
  }
  return [];
}

export { AI_ANSWER_SOURCES };

/** What reading a paid, queued ask again came to (#1160): the rows the
 *  first call would have stored (none for the engine's own no-answer), a
 *  task still not ready, or a failure that reading again will not change. */
export type CollectedAnswer =
  | { readonly kind: "answer"; readonly rows: AiAnswer[] }
  | { readonly kind: "pending" }
  | { readonly kind: "failed"; readonly failure: string };

/**
 * Reads the answer to an ask an earlier pass posted, paid for and stopped
 * waiting on (#1160). Free: nothing is posted. It waits until `untilMs`.
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
    /** Where the battery hears why a call failed (issue 869), so a pass can
     *  stop buying an engine that is refusing and say on the cell what it
     *  was told. */
    onFailure?: OnVendorFailure;
    /** Which ask of the same query this is, 1-based (#1162, D19): a
     *  tracked prompt is asked more than once a week, and a second ask
     *  under the first one's key would be served the first one's answer.
     *  Absent and 1 are the same key the battery has always used. */
    run?: number;
    /** The day the sample belongs to, `YYYY-MM-DD` (#1162): a tracked
     *  prompt is a fresh sample each pass day, never last week's answer
     *  served again inside the battery's cache window. */
    asOf?: string;
    /** When the caller's own ceiling runs out, as epoch milliseconds
     *  (issue 902). On the standard queue this call's wait is a poll that
     *  otherwise runs to `VENDOR.stdQueueDeadlineMin` — forty-five minutes,
     *  inside one call, where a pass's between-calls check cannot reach it.
     *  Passing this is how a bounded pass stays bounded. */
    untilMs?: number;
    /** The wall clock one request of this call may hold (D63, issue 1314):
     *  AI Mode is a SERP endpoint, and a paid pass's live read of it met the
     *  10 s bound sixteen to twenty times a site, each billed. Absent, the
     *  transport's own bound. */
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
