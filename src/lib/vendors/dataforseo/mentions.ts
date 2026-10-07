// SPEC §6 (2026-09-22, #1004) — llmMentions: the seventh endpoint
//
// DataForSEO's LLM Mentions database, `search_mentions/live`: the buyer
// questions answer engines have answered in answers that cite one domain.
// One request per site per week, inside the Monday pass, on the owner's
// ruling of 2026-09-22 after the #920 pilot.
//
// ── Why it is on the barrel, and not beside it ──────────────────────────
//
// `index.ts` is a **closed** list — its own header says "no generic
// `dataforseo(endpoint, params)`" — and `tests/vendors/never-list.test.ts`
// asserts the exported key set exactly, so a seventh export fails that
// test by construction. That is the design question #1004 poses, and the
// answer taken here is to **add the seventh name and widen the assertion
// to seven**, rather than to reach the vendor from a second place.
//
// The barrel is closed against *unapproved* endpoints, not against growth:
// what it buys is that every DataForSEO call in the product goes through
// one credential read (`transport.ts`), one ledger seam (`envelope.ts`)
// and one cap check, and that the never-list is enforced by a function's
// absence. An LLM Mentions call made outside it would have to read
// `env.DATAFORSEO_LOGIN` somewhere else — a second place the credential
// lives, which is the one thing the transport's header says it exists to
// prevent — and would spend outside `CostContext`, which is how #1004's
// "cost recorded against the weekly cap" is met at all. The owner approved
// this endpoint on 2026-09-22, so it is an admitted endpoint and belongs
// on the admitted list. The spike script (`scripts/llm-mentions-pilot.mjs`)
// stayed outside precisely because the owner had **not** yet approved it.
//
// ── The request, exactly as the pilot proved it ─────────────────────────
//
// One target, `search_scope: ["sources"]` (an array — a bare string is
// `40501` and returns nothing at $0.00, which is what cost the first pilot
// run its whole batch, #1003), `search_filter: "include"`,
// `include_subdomains: true`, `limit` at the 100-row cap.
//
// **No `location_name` and no `language_code`.** `buildRequest` pins those
// on every task it builds, and this is the one path family that must not
// carry them: the vendor rejects a field an endpoint does not declare with
// `40501 Invalid Field` — the same code the pilot's own `search_scope`
// failure carries — and the pilot's *successful* run of 2026-09-22 (21
// requests, 1,224 rows) sent neither, because that script builds its body
// by hand. The dataset is US/English by construction, so there is no
// locale to select. `transport.ts` therefore strips them on this prefix,
// exactly as it already strips `depth` on every family that has no depth
// parameter.
//
// ── The money ───────────────────────────────────────────────────────────
//
// $0.10 per request + $0.001 per returned row, measured on the wire by the
// pilot's ten-target probe ($0.100 for 0 rows — per request, not per
// target). So the **reservation** is the worst case, 10c + 100 x 0.1c =
// 20c (`LLM_MENTIONS_WORST_CASE_C`), and the **settlement** is what came
// back: a site with no rows costs 10c, not 20c, and the 10c it does not
// spend stays under the weekly cap for the rest of the pass. The pilot
// measured 16.6c a domain on average.
//
// A billed failure settles at the reservation, which is what every other
// endpoint here does and what §6.5's "money already spent is always
// ledgered" requires; an unbilled one settles at 0c in the seam.
//
// ── Paid only ───────────────────────────────────────────────────────────
//
// §6.2/§6.3 rule the free path makes zero AI Optimization calls, and no
// compile-time shape distinguishes a free `CostContext` from a paid one —
// so this reads `c.cap` and refuses under `FREE` without reaching the
// vendor, the same refusal `ai.ts` makes and for the same reason.
import type { CostContext } from "@/lib/costs";
import { CACHE_WINDOWS_D, LLM_MENTIONS_WORST_CASE_C, PRICE_BOOK } from "@/lib/config/constants";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import {
  asArray,
  asNumber,
  asString,
  callEndpoint,
  isRecord,
  ledgeredWithTotal,
  type EndpointPaths,
  type OnVendorFailure,
} from "./envelope";
import { LLM_MENTIONS_PATH_PREFIX } from "./transport";
import { scopeKey, type CacheScope, type MentionRow, type MentionsResult } from "./types";

/** Live only. The vendor publishes no standard-queue surface for
 *  `search_mentions`, so the type admits no `std` and a caller cannot ask
 *  for one — the same shape `labs.ts` has for a live-only family. */
const SEARCH_MENTIONS_PATHS: EndpointPaths = {
  live: `${LLM_MENTIONS_PATH_PREFIX}/search_mentions/live`,
};

/**
 * One response's rows, and the vendor's own `total_count` beside them.
 *
 * Defensive by field, not by row: a vendor that adds a field changes
 * nothing here, and a vendor that drops one leaves that field `null`
 * rather than dropping the question — the question is the row's subject,
 * and losing it to a missing volume would be losing the measurement to
 * decoration. A row with no question at all is skipped: there is nothing
 * left of it to show.
 */
export function parseMentions(result: unknown, ownDomain: string): { rows: MentionRow[]; total: number | null } | undefined {
  if (!isRecord(result)) return undefined;
  const total = asNumber(result.total_count) ?? null;
  if (result.items === null || result.items === undefined) return { rows: [], total };
  if (!Array.isArray(result.items)) return undefined;

  const rows: MentionRow[] = [];
  for (const item of result.items) {
    if (!isRecord(item)) continue;
    const question = asString(item.question);
    if (!question) continue;
    rows.push({
      question,
      engine: asString(item.platform) ?? null,
      model: asString(item.model_name) ?? null,
      citedUrls: ownCitedUrls(item.sources, ownDomain),
      aiSearchVolume: asNumber(item.ai_search_volume) ?? null,
      monthlySearches: asNumber(item.monthly_searches) ?? null,
      firstSeenAt: asString(item.first_response_at) ?? null,
      lastSeenAt: asString(item.last_response_at) ?? null,
    });
  }
  return { rows, total };
}

/**
 * The site's **own** pages among an answer's cited sources.
 *
 * The host is matched the way the pilot matched it — the registrable
 * domain with any `www.` dropped, and a subdomain admitted, because the
 * request itself was made with `include_subdomains: true` and a row
 * matched on `blog.example.com` is still this customer's page. A source
 * whose URL will not parse is dropped rather than stored as text: what is
 * kept here is an address a card links to.
 */
export function ownCitedUrls(sources: unknown, ownDomain: string): readonly string[] {
  const own = ownDomain.trim().toLowerCase().replace(/^www\./, "");
  const urls = new Set<string>();
  for (const source of asArray(sources)) {
    if (!isRecord(source)) continue;
    const url = asString(source.url);
    if (!url) continue;
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (host === own || host.endsWith(`.${own}`)) urls.add(url);
  }
  return [...urls];
}

/**
 * One site's LLM Mentions, for one week.
 *
 * `scope` carries the site id (BP-008 decision 5): this purchase is one
 * customer's, and a key shared across customers would make a second
 * customer's Monday free and the cost model wrong in the product's favour.
 */
export async function llmMentions(
  c: CostContext,
  a: {
    domain: string;
    /** Live is the only surface; stated rather than defaulted, the way
     *  every mode on this barrel is (BP-008 decision 2). */
    mode: "live";
    scope: CacheScope;
    onFailure?: OnVendorFailure;
  }
): Promise<Measured<MentionsResult>> {
  const at = new Date();
  if (c.cap === "FREE") return unmeasured<MentionsResult>("not_attempted", at);

  return ledgeredWithTotal<MentionRow>(c, {
    source: "ai_optimization/llm_mentions/search_mentions",
    cacheKey: `${a.domain}|${scopeKey(a.scope)}`,
    freshnessDays: CACHE_WINDOWS_D.llmMentions,
    costCents: LLM_MENTIONS_WORST_CASE_C,
    // What the rows actually cost: the flat request charge the vendor takes
    // whatever comes back, plus a tenth of a cent each. `null` is a failure
    // the vendor bills, which settles at what it reserved.
    settleCents: (rows) =>
      rows === null
        ? LLM_MENTIONS_WORST_CASE_C
        : PRICE_BOOK.LLM_MENTIONS_REQUEST_C + rows.length * PRICE_BOOK.LLM_MENTIONS_ROW_C,
    fetch: () =>
      callEndpoint(SEARCH_MENTIONS_PATHS, a.mode, null, {
        target: [
          {
            domain: a.domain,
            search_filter: "include",
            // An array. A bare string is `40501 … must be a non-empty
            // array` and buys nothing (#1003).
            search_scope: ["sources"],
            include_subdomains: true,
          },
        ],
        limit: PRICE_BOOK.LLM_MENTIONS_ROWS,
      }),
    parse: (result) => parseMentions(result, a.domain),
    ...(a.onFailure ? { onFailure: a.onFailure } : {}),
  });
}
