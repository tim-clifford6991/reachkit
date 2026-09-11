// BUILD §5
// src/lib/measure/index.ts — `measureDomain`: one domain, read end to end
// and turned into the four measured quantities plus the on-page facts and
// the robots policy the verdict rests on. This file orchestrates and maps
// outcomes to the trichotomy; it computes no formula (`drivers.ts`) and
// parses no HTML (`parse.ts`).
//
// Every own-document read goes through `safeFetch` (BUILD §6.4) *inside*
// the caller's cost context via `recordFetch` at zero cents (BUILD §6.5) —
// so the bytes land in `fetches`, where `text.ts` re-reads them, and a
// re-run inside the cache window resolves from cache. `capHit()` is
// re-checked before the one priced call (the ranked rows), which is not
// made once the ceiling is hit: `not_attempted`, never a 0, never an
// estimate.
//
// **Tier changes parameters, never arithmetic.** `tier` is read exactly
// twice, both as a table lookup: how many ranked rows to buy and how many
// extra pages `pages?` may carry. No formula, parser or driver differs by
// tier — the free and paid readings of the same bytes are identical.
//
// **No clock.** Every `Measured.at` this file produces is one date — the
// `readAt` of the home document's own outcome — so the same bytes measured
// twice serialise byte-identically, and every value under one verdict
// shares one `at` (`verdict.ts` asserts exactly that). The only
// `new Date(…)` calls here revive an ISO string a stored outcome carried.
//
// **`aiPresence` is `not_attempted` here, by design.** BUILD §5's AIPresence
// is a rate over the twelve questions' SERPs, and the twelve are derived
// (§6.7) from the profile of the text this call has only just read — no
// arm of this signature reaches them. The pipeline fills the field from
// `aiPresenceOf` (`drivers.ts`) over SERPs it has already bought, then
// hands the completed `Drivers` to `verdictOf`. Buying a SERP here would
// spend the free path's ceiling twice on the same rows (§6.4).
import { BATTERY, CACHE_WINDOWS_D, PRICE_BOOK } from "@/lib/config/constants";
import {
  isFetchRefusal,
  refusalOf,
  type CostContext,
  type FetchRefusal,
  type FetchRefusalReason,
  type VendorFailure,
} from "@/lib/costs";
import { safeFetch, type SafeFetchOpts } from "@/lib/egress/safe-fetch";
import { readRobots } from "@/lib/egress/robots";
import type { FetchOutcome, RobotsPolicy } from "@/lib/egress/types";
import { rankedKeywords } from "@/lib/vendors/dataforseo";
import type { RankedResult } from "@/lib/vendors/dataforseo/types";
import { answerabilityOf, foundationsOf, ownRankedOf, searchPresenceOf } from "./drivers";
import { measured, measuredZero, unmeasured, type Measured } from "./measured";
import { OWN_FETCH_OPTS, OWN_FETCH_SOURCE, isStoredDocument, toStoredDocument, type StoredDocument } from "./own-fetch";
import { parseOnPage, visibleText, type OnPageFacts } from "./parse";
import type { Drivers } from "./score";

export type { Drivers } from "./score";
export { aiPresenceOf, answerabilityOf, foundationsOf, ownRankedOf, searchPresenceOf } from "./drivers";
export { parseOnPage, visibleText, type OnPageFacts } from "./parse";
export type { Measured, UnmeasuredReason } from "./measured";

export type Tier = "free" | "deep" | "weekly";

/** The one place `tier` is read: two parameter tables. Free buys the free
 *  row count and measures the home and the detected pricing page only;
 *  the paid tiers buy the paid row count and may carry up to the battery's
 *  page cap in `pages?`. */
const RANKED_ROWS_BY_TIER: Readonly<Record<Tier, 50 | 100 | 300>> = Object.freeze({
  free: PRICE_BOOK.RANKED_FREE_ROWS,
  deep: PRICE_BOOK.RANKED_PAID_ROWS,
  weekly: PRICE_BOOK.RANKED_PAID_ROWS,
});
const EXTRA_PAGES_BY_TIER: Readonly<Record<Tier, number>> = Object.freeze({
  free: 0,
  deep: BATTERY.MEASURED_PAGES_MAX,
  weekly: BATTERY.MEASURED_PAGES_MAX,
});

/** The three seams this file crosses, as a port record so a test can
 *  double them at the module boundary without a network, a database or a
 *  vendor. Production callers pass nothing and get the real modules.
 *
 *  `readRobots` is `src/lib/egress/robots.ts`' (issue #22, since landed).
 *  A reader that cannot determine a policy answers `{ ok: false }`, which
 *  measures as `undeterminable`, never as a fabricated "nothing
 *  blocked". */
export interface MeasurePorts {
  fetchDocument: (url: string, opts?: SafeFetchOpts) => Promise<FetchOutcome>;
  readRobots: (origin: string) => Promise<RobotsPolicy | { ok: false; reason: string }>;
  rankedKeywords: (
    c: CostContext,
    a: { domain: string; rows: 50 | 100 | 300; onFailure?: (failure: VendorFailure) => void }
  ) => Promise<Measured<RankedResult>>;
}

const DEFAULT_PORTS: MeasurePorts = Object.freeze({
  fetchDocument: safeFetch,
  readRobots,
  rankedKeywords,
});

/** `console.log` JSON is this corpus's log channel absent an observability
 *  seam (same convention as `src/lib/egress/safe-fetch.ts`'s `logFetch`
 *  and `src/lib/costs/index.ts`). Never a body, never customer copy. */
function logDriver(event: string, detail: Record<string, string | number | boolean>): void {
  console.log(JSON.stringify({ event, ...detail }));
}

/** The epoch — the deterministic fallback `at` for the one arm no outcome
 *  can date: a `recordFetch` skipped by the cap before the home document
 *  was read. A zero-cent reservation cannot trip the cap while the seam's
 *  own invariant (spent ≤ cap) holds, so this is unreachable in practice;
 *  it exists so the file never reads a clock (`measured.ts`'s `combine`
 *  uses the same fallback). */
const EPOCH = new Date(0);

interface DocumentRead {
  url: string;
  facts: Measured<OnPageFacts>;
  /** The HTML where the document was read; `null` otherwise. Kept only
   *  long enough to detect the pricing link. */
  html: string | null;
  at: Date;
  /** Why the fetcher refused the document, where it did; `null` where it
   *  was read, served from the cache, or never attempted. */
  refusal: FetchRefusalReason | null;
}

/** One own-document read, through `recordFetch` at zero cents so the bytes
 *  are ledgered under `OWN_FETCH_SOURCE`. Maps the outcome to the
 *  trichotomy once, here, so no call site invents a second mapping:
 *  `ok: false` → `undeterminable`; a cap-skip → `not_attempted`; a read
 *  document → `measured`, or `zero` when it parsed to nothing (no headings,
 *  no visible text — REQ-004 c7's "read it; it contained none"). */
async function readDocument(c: CostContext, ports: MeasurePorts, url: string): Promise<DocumentRead> {
  // The failed outcome is kept beside the ledgered refusal so its `readAt`
  // can date the `unmeasured` arm — the row stores the refusal, not a date.
  const stash: { failure: Extract<FetchOutcome, { ok: false }> | null } = { failure: null };
  const result = await c.recordFetch<StoredDocument | FetchRefusal>({
    source: OWN_FETCH_SOURCE,
    cacheKey: url,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    run: async () => {
      const outcome = await ports.fetchDocument(url, OWN_FETCH_OPTS);
      if (outcome.ok) return toStoredDocument(outcome);
      stash.failure = outcome;
      // A refusal is a row, never a `null` — `fetches.payload` is `not
      // null`, and the insert's throw used to become the stage's reason
      // in place of the refusal itself (issue #479).
      return refusalOf(outcome);
    },
  });

  if ("skipped" in result) {
    return { url, facts: unmeasured("not_attempted", EPOCH), html: null, at: EPOCH, refusal: null };
  }
  const stored = result.payload;
  if (!isStoredDocument(stored)) {
    const at = stash.failure === null ? EPOCH : stash.failure.readAt;
    const refusal = isFetchRefusal(stored) ? stored.refusal : null;
    return { url, facts: unmeasured("undeterminable", at), html: null, at, refusal };
  }
  const at = new Date(stored.readAt);
  const facts = parseOnPage({ url: stored.url, html: stored.html });
  const isEmpty = facts.headings === 0 && facts.visibleChars === 0;
  return {
    url,
    facts: isEmpty ? measuredZero(facts, at) : measured(facts, at),
    html: stored.html,
    at,
    refusal: null,
  };
}

/** Re-stamps a read's `at` to the scan's one date. The document's own
 *  `readAt` survives in the `fetches` row; the verdict carries one date. */
function stampedAt<T>(m: Measured<T>, at: Date): Measured<T> {
  return m.kind === "unmeasured" ? { kind: "unmeasured", reason: m.reason, at } : { kind: m.kind, value: m.value, at };
}

// ── Pricing-page detection over the home document's own links ───────────
//
// BUILD §6.4: "no crawling — the page set is only URLs we already hold …
// or construct by name". The pricing page is the one page §6.7 step 1
// reads beside the home, found by its link on the home document: the
// first same-host anchor whose path's last segment is a pricing word.
// Deterministic — document order, first match.
const ANCHOR_HREF_RE = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
const PRICING_PATH_RE = /(?:^|\/)(?:pricing|prices?|plans)\/?$/i;

export function detectPricingUrl(html: string, homeUrl: string): string | null {
  let home: URL;
  try {
    home = new URL(homeUrl);
  } catch {
    return null;
  }
  ANCHOR_HREF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_HREF_RE.exec(html)) !== null) {
    const href = match[1] ?? match[2] ?? "";
    if (!href) continue;
    try {
      const resolved = new URL(href, home);
      if (resolved.hostname !== home.hostname) continue;
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;
      if (!PRICING_PATH_RE.test(resolved.pathname)) continue;
      resolved.hash = "";
      const candidate = resolved.toString();
      if (candidate === home.toString()) continue;
      return candidate;
    } catch {
      // Not a resolvable URL — never a candidate, never a throw.
    }
  }
  return null;
}

function homeUrlOf(domain: string): string {
  return `https://${domain}/`;
}

export interface DomainMeasurement {
  drivers: Drivers;
  /** The rendered text of the documents this call read. Handed over rather
   *  than re-fetched: BUILD §6.7 step 1 derives the business profile "from
   *  the fetched home + pricing pages", and this call is the one that
   *  fetched them — a second read of the customer's own server for text
   *  already in hand is exactly what §6.4's never-pull list forbids.
   *  `null` where the document was not read. */
  text: { home: string | null; pricing: string | null };
  /** The home document's facts — `unmeasured` when it could not be read,
   *  never a fabricated all-zero `OnPageFacts`. */
  onPage: Measured<OnPageFacts>;
  /** The detected pricing page, or `null` when the home document links to
   *  none (a fact about the home document, not a failed read). */
  pricing: { url: string; facts: Measured<OnPageFacts> } | null;
  robots: Measured<RobotsPolicy>;
  /** The customer's own ranked count, from the same call `searchPresence`
   *  was computed from — the rows themselves, not the 0–100 sub-measure.
   *  §6.6 bands every rival against it and §7's two winnability bars are
   *  multiples of it, so it travels with the measurement rather than being
   *  bought a second time. `unmeasured` carries the same reason
   *  `searchPresence` carries; the two are the same read. */
  ownRanked: Measured<number>;
  /** Why the fetcher refused the home document, where it did (issue #479);
   *  `null` where it was read. A refused home is the whole site unread:
   *  nothing after it is attempted — no pricing page, no robots read, no
   *  priced call — and the pass ends `site_unreadable` (`src/lib/scan/
   *  run.ts`) rather than `complete`. */
  homeRefusal: FetchRefusalReason | null;
}

/** Reads a domain — home document, detected pricing page, up to the tier's
 *  page allowance of `pages?`, robots policy, the customer's own ranked
 *  rows — and returns BUILD §5's four measured quantities with the facts
 *  the verdict rests on. Never throws for a domain that cannot be read:
 *  every failure is an `unmeasured` arm with its reason. Calls are made
 *  one at a time (`recordFetch`'s own sequential contract). */
export async function measureDomain(
  c: CostContext,
  a: { domain: string; tier: Tier; pages?: readonly string[] },
  ports: MeasurePorts = DEFAULT_PORTS
): Promise<DomainMeasurement> {
  const homeUrl = homeUrlOf(a.domain);

  // 1. The home document — its `readAt` is the scan's one date.
  const home = await readDocument(c, ports, homeUrl);
  const at = home.at;
  const onPage = home.facts;

  // 1a. A refused home document is an unread site. Nothing else is read or
  //     bought for it: the pass stops here and says why (issue #479).
  if (home.refusal !== null) {
    logDriver("home_refused", { domain: a.domain, refusal: home.refusal });
    const robots = unmeasured<RobotsPolicy>("not_attempted", at);
    return {
      drivers: {
        foundations: foundationsOf({ onPage, robots, at }),
        answerability: answerabilityOf({ pages: [onPage], at }),
        searchPresence: unmeasured("not_attempted", at),
        aiPresence: unmeasured("not_attempted", at),
      },
      text: { home: null, pricing: null },
      onPage,
      pricing: null,
      robots,
      ownRanked: unmeasured("not_attempted", at),
      homeRefusal: home.refusal,
    };
  }

  // 2. The pricing page, from the home document's own links.
  const pricingUrl = home.html === null ? null : detectPricingUrl(home.html, homeUrl);
  const pricingRead = pricingUrl === null ? null : await readDocument(c, ports, pricingUrl);
  const pricingHtml = pricingRead === null ? null : pricingRead.html;
  const pricing =
    pricingUrl === null || pricingRead === null
      ? null
      : { url: pricingUrl, facts: stampedAt(pricingRead.facts, at) };

  // 3. The caller's pages, capped by the tier's allowance, deduplicated
  //    against what was already read, in the order given.
  const seen = new Set<string>([homeUrl, ...(pricingUrl === null ? [] : [pricingUrl])]);
  const extra: string[] = [];
  for (const url of a.pages ?? []) {
    if (extra.length >= EXTRA_PAGES_BY_TIER[a.tier]) break;
    if (seen.has(url)) continue;
    seen.add(url);
    extra.push(url);
  }
  const extraFacts: Measured<OnPageFacts>[] = [];
  for (const url of extra) {
    extraFacts.push(stampedAt((await readDocument(c, ports, url)).facts, at));
  }

  // 4. The robots policy at the origin. `absent` is a read with nothing in
  //    it (the `zero` arm); a reader that cannot determine is `undeterminable`.
  let robots: Measured<RobotsPolicy>;
  try {
    const policy = await ports.readRobots(new URL(homeUrl).origin);
    robots = !policy.ok
      ? unmeasured("undeterminable", at)
      : policy.absent
        ? measuredZero(policy, at)
        : measured(policy, at);
  } catch {
    robots = unmeasured("undeterminable", at);
  }

  // 5. The one priced call. `capHit()` first — the ceiling names itself in
  //    the log and the call is not made (BUILD §6.5, BP-010 NFR budget).
  let searchPresence: Measured<number>;
  // The same rows, read a second way: the count itself, which §6.6's
  // banding and §7's bars are expressed in multiples of. Never a second
  // call — it is assigned in every arm below, beside the driver.
  let ownRanked: Measured<number>;
  if (c.capHit()) {
    logDriver("driver_not_attempted", { driver: "searchPresence", ceiling: "spend_cap", domain: a.domain });
    searchPresence = unmeasured("not_attempted", at);
    ownRanked = unmeasured("not_attempted", at);
  } else {
    // A failed call is ledgered as the failure and answers `unmeasured`
    // (issue #504); this is where the stage hears which failure it was, so
    // the reason it logs is the vendor's and never a ledger insert's.
    const heard: { failure: VendorFailure | null } = { failure: null };
    try {
      const ranked = await ports.rankedKeywords(c, {
        domain: a.domain,
        rows: RANKED_ROWS_BY_TIER[a.tier],
        onFailure: (failure) => {
          heard.failure = failure;
        },
      });
      if (heard.failure !== null) {
        logDriver("driver_undeterminable", {
          driver: "searchPresence",
          domain: a.domain,
          because: heard.failure.vendorFailure,
          endpoint: heard.failure.endpoint,
        });
      }
      // Two readings of one answer: §5's score is over the rows bought,
      // and §6.6's own count is the vendor's total (#117).
      searchPresence = searchPresenceOf({
        ranked: ranked.kind === "unmeasured" ? ranked : { ...ranked, value: ranked.value.rows },
        at,
      });
      ownRanked = ownRankedOf({ ranked, at });
    } catch (error) {
      logDriver("driver_undeterminable", {
        driver: "searchPresence",
        domain: a.domain,
        because: error instanceof Error ? error.message : String(error),
      });
      searchPresence = unmeasured("undeterminable", at);
      ownRanked = unmeasured("undeterminable", at);
    }
  }

  // 6. The four measured quantities.
  const pages: Measured<OnPageFacts>[] = [onPage, ...(pricing === null ? [] : [pricing.facts]), ...extraFacts];
  const drivers: Drivers = {
    foundations: foundationsOf({ onPage, robots, at }),
    answerability: answerabilityOf({ pages, at }),
    searchPresence,
    aiPresence: unmeasured("not_attempted", at), // filled by the pipeline from `aiPresenceOf` — see the header
  };
  logDriver("drivers_measured", {
    domain: a.domain,
    foundations: drivers.foundations.kind,
    answerability: drivers.answerability.kind,
    searchPresence: drivers.searchPresence.kind,
    aiPresence: drivers.aiPresence.kind,
  });

  return {
    drivers,
    text: {
      home: home.html === null ? null : visibleText(home.html),
      pricing: pricingHtml === null ? null : visibleText(pricingHtml),
    },
    onPage,
    pricing,
    robots,
    ownRanked,
    homeRefusal: null,
  };
}
