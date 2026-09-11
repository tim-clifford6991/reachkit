// BUILD §6.3 — serpOrganic: one Google organic SERP, top 10 plus its AI Overview (issue #23)
//
// The SERP the product already buys carries the `ai_overview` item and its
// per-domain `references` at 0¢ extra (§6.2) — one call, one ledger row,
// both halves in one `SerpResult`. Depth 10 and `SERP_LOCATION` are fixed
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
// search, which `SPEC.md` §6.8 §5's "monthly per customer" roll-up already
// assumed it was not — see `CacheScope`. And §6.4's window is "SERPs 30d
// (**except the weekly target re-check**)"; that exception had no way to be
// asked for, so three weeks in four the weekly re-check would serve a
// cached SERP wearing this week's date and "measured once a week" would be
// met by a monthly measurement. The window is an argument here rather than
// a branch on tier: this module knows nothing about tiers, and the caller
// passes `CACHE_WINDOWS_D.serp` or `.serpWeeklyRecheck` from its own
// parameters.
import type { CostContext } from "@/lib/costs";
import { ASYNC_AIO_SURCHARGE_MULTIPLIER, PRICE_BOOK, SERP_LOCATION } from "@/lib/config/constants";
import { mapMeasured, type Measured } from "@/lib/measure/measured";
import { asArray, asNumber, asString, callEndpoint, isRecord, ledgered, referenceDomains, type EndpointPaths } from "./envelope";
import type { DataForSeoMode } from "./transport";
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
  for (const element of asArray(item.items)) {
    if (!isRecord(element)) continue;
    for (const domain of referenceDomains(element.references)) seen.add(domain);
  }
  return {
    present: true,
    asynchronousAiOverview: item.asynchronous_ai_overview === true,
    referenceDomains: [...seen],
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
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    if (item.type === "organic") {
      const position = asNumber(item.rank_group) ?? asNumber(item.rank_absolute);
      const domain = asString(item.domain)?.toLowerCase();
      if (position === undefined || !domain) continue;
      organic.push({ position, domain, url: asString(item.url) ?? "", title: asString(item.title) ?? "" });
    } else if (item.type === "ai_overview") {
      aiOverview = parseAiOverview(item);
    }
  }
  if (organic.length === 0 && !aiOverview.present) return [];
  return [{ organic, aiOverview }];
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
    scope: CacheScope;
    /** §6.4's window for this call site: `CACHE_WINDOWS_D.serp` at every
     *  one except the weekly target re-check, which passes
     *  `.serpWeeklyRecheck`. Required for the same reason. */
    freshnessDays: number;
  }
): Promise<Measured<SerpResult>> {
  const base = basePriceCents(a.mode);
  const flagged = a.loadAsyncAiOverview;
  const rows = await ledgered<SerpResult>(c, {
    source: "serp/google/organic",
    cacheKey: `${a.query}|${SERP_LOCATION.location}|${SERP_LOCATION.language}|aio:${flagged ? "async" : "cached"}|${scopeKey(a.scope)}`,
    freshnessDays: a.freshnessDays,
    costCents: flagged ? base * ASYNC_AIO_SURCHARGE_MULTIPLIER : base,
    ...(flagged ? { settleCents: (r: readonly SerpResult[] | null) => settledCents(base, r) } : {}),
    fetch: () =>
      callEndpoint(PATHS, a.mode, {
        keyword: a.query,
        // The never-list's one admitted exception, and this is the only
        // line in the module that can set it. Only ever the caller's own
        // decided boolean; `false` is sent explicitly, never omitted.
        load_async_ai_overview: flagged,
      }),
    parse: parseSerp,
  });
  return mapMeasured(rows, (r) => r[0] ?? EMPTY_SERP);
}
