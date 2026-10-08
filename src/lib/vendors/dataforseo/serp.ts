// BUILD §6.3 — serpOrganic: one Google organic SERP, top 10 plus its AI Overview (issue #23)
//
// The SERP the product already buys carries the `ai_overview` item and its
// per-domain `references` at 0¢ extra (§6.2) — one call, one ledger row,
// both halves in one `SerpResult`. Depth 10 is fixed and the locale written
// in `transport.ts`; `mode` is required (a scheduled caller cannot inherit
// `live`).
//
// `loadAsyncAiOverview` is required, never defaulted (DECISIONS 2026-09-03,
// ADR-094): `true` on the free report's initial twelve-question pass only,
// `false` everywhere else, including a correction's re-run. A flagged call
// **reserves** `ASYNC_AIO_SURCHARGE_MULTIPLIER` × the mode's base price and
// **settles** the vendor's documented charge from the response — base
// price where the `ai_overview` element is absent or carries
// `asynchronous_ai_overview: false`, the surcharge where it does not
// ("all extra charges will be returned to your account balance"). The
// vendor rule lives here; the cost seam stays generic.
//
// Cache (§6.4): keyed on query, locale, the flag and **whose purchase it
// is** — a flagged call is never served an unflagged SERP, whose `null`
// overview could mean "not fetched" rather than "none appeared" (ADR-094
// d4). Mode is not in the key: live and standard return the same SERP.
//
// **The scope is in the key, and the window is the caller's** (#75).
// Neither was expressible before, and §6.4 states both. A key of query and
// locale alone is shared across every customer whose market contains that
// search, which `DATA-COSTS.md` §5's "monthly per customer" roll-up already
// assumed it was not — see `CacheScope`. And §6.4's window is "SERPs 30d
// (**except the weekly target re-check**)"; that exception had no way to be
// asked for, so three weeks in four the weekly re-check would serve a
// cached SERP wearing this week's date and "measured once a week" would be
// met by a monthly measurement. The window is an argument here rather than
// a branch on tier: this module knows nothing about tiers, and the caller
// passes `CACHE_WINDOWS_D.serp` or `.serpWeeklyRecheck` from its own
// parameters.
import type { CostContext } from "@/lib/costs";
import { ASYNC_AIO_SURCHARGE_MULTIPLIER, PRICE_BOOK } from "@/lib/config/constants";
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
import { localeCacheKey, type DataForSeoMode } from "./transport";
import { scopeKey, type CacheScope, type SerpAiOverview, type SerpOrganicRow, type SerpResult } from "./types";

const ORGANIC = "/v3/serp/google/organic";
const PATHS: EndpointPaths = {
  live: `${ORGANIC}/live/advanced`,
  std: { taskPost: `${ORGANIC}/task_post`, taskGet: (id) => `${ORGANIC}/task_get/advanced/${encodeURIComponent(id)}` },
};

const NO_AI_OVERVIEW: SerpAiOverview = { present: false, asynchronousAiOverview: false, referenceDomains: [] };
export const EMPTY_SERP: SerpResult = { organic: [], aiOverview: NO_AI_OVERVIEW };

function basePriceCents(mode: DataForSeoMode): number {
  return mode === "live" ? PRICE_BOOK.SERP_LIVE_C : PRICE_BOOK.SERP_STD_C;
}

/** The vendor's documented refund rule, read off the response. */
function settledCents(base: number, rows: readonly SerpResult[] | null): number {
  const overview = rows?.[0]?.aiOverview;
  return overview?.present && overview.asynchronousAiOverview ? base * ASYNC_AIO_SURCHARGE_MULTIPLIER : base;
}

function parseAiOverview(item: Record<string, unknown>): SerpAiOverview {
  const seen = new Set<string>(referenceDomains(item.references));
  const urls = new Set<string>(referenceUrls(item.references));
  for (const element of asArray(item.items)) {
    if (!isRecord(element)) continue;
    for (const domain of referenceDomains(element.references)) seen.add(domain);
    for (const url of referenceUrls(element.references)) urls.add(url);
  }
  return {
    present: true,
    asynchronousAiOverview: item.asynchronous_ai_overview === true,
    referenceDomains: [...seen],
    referenceUrls: [...urls],
  };
}

/** `[]` is the vendor's own zero-result — a SERP with no organic rows and
 *  no AI Overview — so the seam never caches it (§6.4). */
export function parseSerp(result: unknown): SerpResult[] | undefined {
  if (!isRecord(result)) return undefined;
  if (result.items === null || result.items === undefined) return [];
  if (!Array.isArray(result.items)) return undefined;

  const organic: SerpOrganicRow[] = [];
  let aiOverview: SerpAiOverview = NO_AI_OVERVIEW;
  // SPEC §7 (owner, D61; issue 1295): the advanced SERP already carries
  // Google's "People also ask" and its related searches at no extra charge.
  const peopleAlsoAsk: string[] = [];
  const relatedSearches: string[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    if (item.type === "organic") {
      const position = asNumber(item.rank_group) ?? asNumber(item.rank_absolute);
      const domain = asString(item.domain)?.toLowerCase();
      if (position === undefined || !domain) continue;
      organic.push({ position, domain, url: asString(item.url) ?? "", title: asString(item.title) ?? "" });
    } else if (item.type === "ai_overview") {
      aiOverview = parseAiOverview(item);
    } else if (item.type === "people_also_ask") {
      for (const element of asArray(item.items)) {
        const question = isRecord(element) ? asString(element.title)?.trim() : undefined;
        if (question) peopleAlsoAsk.push(question);
      }
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
    },
  ];
}

export async function serpOrganic(
  c: CostContext,
  a: {
    query: string;
    mode: DataForSeoMode;
    loadAsyncAiOverview: boolean;
    /** Whose purchase this is — the site on a paid pass, the domain on the
     *  free one. Required, never defaulted: a default would be a decision
     *  about somebody's costs made by whoever forgot to pass it. */
    /** The site's country and language (D66): where the read is made, and
     *  part of its cache key. */
    locale: Locale;
    scope: CacheScope;
    /** §6.4's window for this call site: `CACHE_WINDOWS_D.serp` at every
     *  one except the weekly target re-check, which passes
     *  `.serpWeeklyRecheck`. Required for the same reason. */
    freshnessDays: number;
    /** Where this call site hears why a call failed (issue 865), so it can
     *  decide whether one more ask is worth making and, where it is not,
     *  put the vendor's own kind on the cell. */
    onFailure?: OnVendorFailure;
    /** The wall clock this request may hold (issue 875). The free path's
     *  twelve name a shorter one than the transport's default, because the
     *  stage that buys them is thirteen seconds long and one stuck call
     *  used to hold a quarter of it for almost all of it. */
    abortMs?: number;
    /** When the caller's own ceiling runs out, as epoch milliseconds (issue
     *  902). `abortMs` above bounds one request; on the standard queue —
     *  which is every scheduled pass's mode — this call is a `task_post`
     *  and then a poll that otherwise runs to `VENDOR.stdQueueDeadlineMin`,
     *  and that wait is inside the call where a between-calls ceiling check
     *  cannot reach it. */
    untilMs?: number;
    /** The caller reads this SERP's "People also ask" and related searches
     *  (D61). It is then keyed apart, so it is never served a SERP stored
     *  before they were read, whose silence about them means nothing. */
    questions?: true;
  }
): Promise<Measured<SerpResult>> {
  const base = basePriceCents(a.mode);
  const flagged = a.loadAsyncAiOverview;
  /** Issue 715: set only where the seam served this answer out of
   *  `fetches`, and then to the moment that row was bought. */
  let reusedFrom: Date | null = null;
  const rows = await ledgered<SerpResult>(c, {
    source: "serp/google/organic",
    cacheKey: `${a.query}|${localeCacheKey(a.locale)}|aio:${flagged ? "async" : "cached"}|${scopeKey(a.scope)}${a.questions === true ? "|paa" : ""}`,
    freshnessDays: a.freshnessDays,
    costCents: flagged ? base * ASYNC_AIO_SURCHARGE_MULTIPLIER : base,
    ...(flagged ? { settleCents: (r: readonly SerpResult[] | null) => settledCents(base, r) } : {}),
    fetch: () =>
      callEndpoint(
        PATHS,
        a.mode,
        a.locale,
        {
          keyword: a.query,
          // The never-list's one admitted exception, and this is the only
          // line in the module that can set it. Only ever the caller's own
          // decided boolean; `false` is sent explicitly, never omitted.
          load_async_ai_overview: flagged,
        },
        a.abortMs,
        a.untilMs
      ),
    parse: parseSerp,
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
    onReused: (storedAt) => {
      reusedFrom = storedAt;
    },
  });
  return mapMeasured(rows, (r) => {
    const serp = r[0] ?? EMPTY_SERP;
    // The stamp rides on the result the report stores, so a screen reading
    // a report months later still knows which of its answers were reused
    // and from when. Never written where the pass bought the answer.
    const at: Date | null = reusedFrom;
    return at === null ? serp : { ...serp, reusedFrom: at.toISOString() };
  });
}
