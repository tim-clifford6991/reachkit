// BUILD §6.3 — serpOrganic: one Google organic SERP, top 10 plus its AI Overview
// The `ai_overview` item and its `references` ride on the SERP at 0¢ extra (§6.2): one call, one ledger row.
// Depth past 10 is billed per page of ten. `mode` is required, so a scheduled caller cannot inherit `live`.
// `loadAsyncAiOverview` is required, never defaulted. Unflagged, an overview Google loads after the page has no sources
// and is marked `unread`, never an answer that names nobody. Flagged, the call reserves one extra base price whatever
// the depth and settles from the response: the vendor refunds the surcharge where no async overview came back.
// The vendor rule lives here; the cost seam stays generic.
// Cache (§6.4): keyed on query, locale, the flag and `CacheScope`, so a flagged call never gets an unflagged SERP whose
// missing overview may mean "not fetched". Mode is not in the key: live, standard and both priorities return one SERP.
// The window is the caller's (`CACHE_WINDOWS_D.serp` or `.serpWeeklyRecheck`), since this module knows nothing of tiers.
import type { CostContext } from "@/lib/costs";
import { ASYNC_AIO_SURCHARGE_MULTIPLIER, PRICE_BOOK, VENDOR } from "@/lib/config/constants";
import type { Locale } from "@/lib/locale/locales";
import { mapMeasured, type Measured } from "@/lib/measure/measured";
import {
  asArray,
  asNumber,
  asString,
  callEndpoint,
  isRecord,
  ledgered,
  referenceDomains,
  referenceUrls,
  type EndpointPaths,
  type OnVendorFailure,
} from "./envelope";
import { resolvedHost } from "@/lib/market/rivals/domains";
import { placeCacheKey, type DataForSeoMode, type SerpDepth } from "./transport";
import { AI_OVERVIEW_TEXT_MAX_CHARS, scopeKey, type CacheScope, type SerpAiOverview, type SerpOrganicRow, type SerpResult } from "./types";

const ORGANIC = "/v3/serp/google/organic";
const PATHS: EndpointPaths = {
  live: `${ORGANIC}/live/advanced`,
  std: { taskPost: `${ORGANIC}/task_post`, taskGet: (id) => `${ORGANIC}/task_get/advanced/${encodeURIComponent(id)}` },
};

const NO_AI_OVERVIEW: SerpAiOverview = { present: false, asynchronousAiOverview: false, referenceDomains: [] };
export const EMPTY_SERP: SerpResult = { organic: [], aiOverview: NO_AI_OVERVIEW };

/** The vendor's number for the queue's high priority (`priority`, 1 or 2). */
const QUEUE_PRIORITY_HIGH = 2;

function basePriceCents(mode: DataForSeoMode, highPriority: boolean): number {
  if (mode === "live") return PRICE_BOOK.SERP_LIVE_C;
  return highPriority ? PRICE_BOOK.SERP_STD_HIGH_C : PRICE_BOOK.SERP_STD_C;
}

/** The vendor's documented refund rule, read off a live response. A queued task is charged at post, surcharge
 *  included, so it settles at what it reserved. */
function settledCents(base: number, pages: number, mode: DataForSeoMode, rows: readonly SerpResult[] | null): number {
  const surcharged = surchargedCents(base, pages);
  if (mode === "std") return surcharged;
  const overview = rows?.[0]?.aiOverview;
  return overview?.present && overview.asynchronousAiOverview ? surcharged : base * pages;
}

/** The vendor's surcharge is one base price per task, not per page of ten. */
function surchargedCents(base: number, pages: number): number {
  return base * (pages + ASYNC_AIO_SURCHARGE_MULTIPLIER - 1);
}

function parseAiOverview(item: Record<string, unknown>): SerpAiOverview {
  const seen = new Set<string>(referenceDomains(item.references));
  const urls = new Set<string>(referenceUrls(item.references));
  const blocks: string[] = [];
  for (const element of asArray(item.items)) {
    if (!isRecord(element)) continue;
    for (const domain of referenceDomains(element.references)) seen.add(domain);
    for (const url of referenceUrls(element.references)) urls.add(url);
    const block = asString(element.markdown) ?? [asString(element.title), asString(element.text)].filter(Boolean).join("\n");
    if (block) blocks.push(block);
  }
  // The answer's text, from the response already bought: the item's own
  // markdown, else its elements' text blocks.
  const text = (asString(item.markdown) ?? asString(item.text) ?? blocks.join("\n\n")).trim();
  return {
    present: true,
    asynchronousAiOverview: item.asynchronous_ai_overview === true,
    referenceDomains: [...seen],
    referenceUrls: [...urls],
    ...(text === "" ? {} : { text: text.slice(0, AI_OVERVIEW_TEXT_MAX_CHARS) }),
  };
}

/** An AI Overview the vendor flagged as loaded after the page, on a read
 *  that did not buy that load, with no sources: unread. Applied
 *  where the answer is handed over, so a SERP served from the cache is
 *  marked like one just bought. */
function markUnread(serp: SerpResult, flagged: boolean): SerpResult {
  const overview = serp.aiOverview;
  if (flagged || !overview.present || !overview.asynchronousAiOverview || overview.referenceDomains.length > 0) return serp;
  return { ...serp, aiOverview: { ...overview, unread: true } };
}

/** `[]` is the vendor's own zero-result — a SERP with no organic rows and
 *  no AI Overview — so the seam never caches it (§6.4). */
export function parseSerp(result: unknown): SerpResult[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;

  const organic: SerpOrganicRow[] = [];
  let aiOverview: SerpAiOverview = NO_AI_OVERVIEW;
  // SPEC §7 (D61): the advanced SERP carries "People also ask" and related searches at no extra charge.
  const peopleAlsoAsk: string[] = [];
  const relatedSearches: string[] = [];
  // SPEC §6 (D67): the local pack rides on the same SERP; only businesses with a site are kept.
  const localPack: { title: string; domain: string; unresolved?: true }[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    if (item.type === "organic") {
      const position = asNumber(item.rank_group) ?? asNumber(item.rank_absolute);
      const domain = asString(item.domain)?.toLowerCase();
      if (position === undefined || !domain) continue;
      const url = asString(item.url) ?? "";
      const host = resolvedHost({ domain, url, breadcrumb: asString(item.breadcrumb), websiteName: asString(item.website_name) });
      organic.push({ position, domain: host ?? "", url, title: asString(item.title) ?? "", ...(host === null ? { unresolved: true as const } : {}) });
    } else if (item.type === "ai_overview") {
      aiOverview = parseAiOverview(item);
    } else if (item.type === "people_also_ask") {
      for (const element of asArray(item.items)) {
        const question = isRecord(element) ? asString(element.title)?.trim() : undefined;
        if (question) peopleAlsoAsk.push(question);
      }
    } else if (item.type === "local_pack") {
      const listed = asString(item.domain)?.toLowerCase();
      const title = asString(item.title)?.trim();
      if (!listed || !title) continue;
      const domain = resolvedHost({ domain: listed, url: asString(item.url) });
      if (domain === null) localPack.push({ title, domain: "", unresolved: true });
      else if (!localPack.some((held) => held.domain === domain)) localPack.push({ title, domain });
    } else if (item.type === "related_searches") {
      for (const search of asArray(item.items)) {
        const text = asString(search)?.trim();
        if (text) relatedSearches.push(text);
      }
    }
  }
  if (organic.length === 0 && !aiOverview.present) return [];
  return [
    {
      organic,
      aiOverview,
      ...(peopleAlsoAsk.length === 0 ? {} : { peopleAlsoAsk }),
      ...(relatedSearches.length === 0 ? {} : { relatedSearches }),
      ...(localPack.length === 0 ? {} : { localPack }),
    },
  ];
}

export async function serpOrganic(
  c: CostContext,
  a: {
    query: string;
    mode: DataForSeoMode;
    loadAsyncAiOverview: boolean;
    /** The site's country and language (D66): where the read is made, and
     *  part of its cache key. */
    locale: Locale;
    /** Whose purchase this is. Required: a default would decide somebody's costs for whoever forgot to pass it. */
    scope: CacheScope;
    /** §6.4's window: `CACHE_WINDOWS_D.serp`, or `.serpWeeklyRecheck` for the weekly target re-check. Required likewise. */
    freshnessDays: number;
    /** Where this call site hears why a call failed, so it can
     *  decide whether one more ask is worth making and, where it is not,
     *  put the vendor's own kind on the cell. */
    onFailure?: OnVendorFailure;
    /** The wall clock this request may hold. The free path passes less than the transport's default, so one stuck call
     *  cannot hold its short stage. */
    abortMs?: number;
    /** When the caller's own ceiling runs out, as epoch milliseconds. `abortMs` bounds one request; on the standard
     *  queue the poll otherwise runs to `VENDOR.stdQueueDeadlineMin`, out of reach of a between-calls check. */
    untilMs?: number;
    /** The queue's high priority, for a pass somebody is
     *  waiting on: twice the queue's price, and ready in seconds where the
     *  normal queue has taken minutes. Read on the standard queue only;
     *  the live surface has no such field. */
    priority?: "high";
    /** How often the queue is asked whether the task is ready, where the
     *  caller cannot wait `VENDOR.stdQueuePollIntervalS` between asks. */
    pollMs?: number;
    /** The caller reads this SERP's "People also ask" and related searches
     *  (D61). It is then keyed apart, so it is never served a SERP stored
     *  before they were read, whose silence about them means nothing. */
    questions?: true;
    /** A read deeper than `VENDOR.serpDepth`, for a page's own search. */
    depth?: SerpDepth;
  }
): Promise<Measured<SerpResult>> {
  const highPriority = a.mode === "std" && a.priority === "high";
  const base = basePriceCents(a.mode, highPriority);
  const flagged = a.loadAsyncAiOverview;
  const depth = a.depth ?? VENDOR.serpDepth;
  const pages = Math.ceil(depth / 10);
  /** Set only where the seam served this answer from `fetches`, to when that row was bought. */
  let reusedFrom: Date | null = null;
  const rows = await ledgered<SerpResult>(c, {
    source: "serp/google/organic",
    cacheKey: `${a.query}|${placeCacheKey(a.locale)}|aio:${flagged ? "async" : "cached"}|${scopeKey(a.scope)}${a.questions === true ? "|paa" : ""}${depth === VENDOR.serpDepth ? "" : `|depth:${depth}`}`,
    freshnessDays: a.freshnessDays,
    costCents: flagged ? surchargedCents(base, pages) : base * pages,
    ...(flagged ? { settleCents: (r: readonly SerpResult[] | null) => settledCents(base, pages, a.mode, r) } : {}),
    fetch: () =>
      callEndpoint(
        PATHS,
        a.mode,
        a.locale,
        {
          keyword: a.query,
          // The never-list's one exception, set only here, from the caller's boolean; `false` is sent, never omitted.
          load_async_ai_overview: flagged,
          ...(highPriority ? { priority: QUEUE_PRIORITY_HIGH } : {}),
        },
        a.abortMs,
        a.untilMs,
        a.pollMs,
        a.depth
      ),
    parse: parseSerp,
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
    onReused: (storedAt) => {
      reusedFrom = storedAt;
    },
  });
  return mapMeasured(rows, (r) => {
    const serp = markUnread(r[0] ?? EMPTY_SERP, flagged);
    // On the stored result, so a report read later still knows which answers were reused; never set where this pass bought it.
    const at: Date | null = reusedFrom;
    return at === null ? serp : { ...serp, reusedFrom: at.toISOString() };
  });
}
