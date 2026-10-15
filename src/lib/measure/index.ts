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
// **No clock.** Every figure this file computes carries one date, the
// caller's `at`: the moment the pass started (issue 1392). It was the home
// document's `readAt`, so a pass served a stored read wore the day of that
// read, not its own. The same bytes measured twice under one `at` still
// serialise byte-identically, and every value under one verdict shares one
// `at` (`verdict.ts` asserts exactly that). The home page's own facts keep
// the date the page was read. The only `new Date(…)` calls here revive an
// ISO string a stored outcome carried.
//
// **`aiPresence` is `not_attempted` here, by design.** BUILD §5's AIPresence
// is a rate over the twelve questions' SERPs, and the twelve are derived
// (§6.7) from the profile of the text this call has only just read — no
// arm of this signature reaches them. The pipeline fills the field from
// `aiPresenceOf` (`drivers.ts`) over SERPs it has already bought, then
// hands the completed `Drivers` to `verdictOf`. Buying a SERP here would
// spend the free path's ceiling twice on the same rows (§6.4).
import { pagePathAlternation } from "@/lib/locale/language";
import { readLocale, type Locale, type ResolvedLocale } from "@/lib/locale";
import { readPlaceSignals, type PlaceSignals } from "@/lib/locale/place";
import { BATTERY, CACHE_WINDOWS_D, CHALLENGE_RENDER_MS, HOME_RETRY, PRICE_BOOK } from "@/lib/config/constants";
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
import type { RankedResult, RankedRow } from "@/lib/vendors/dataforseo/types";
import { BOT_PROTECTION, challengeOf, notTheSiteOf, type ProtectionVendor } from "./challenge";
import { answerabilityOf, foundationsOf, ownRankedOf, searchPresenceOf } from "./drivers";
import { measured, measuredZero, unmeasured, type Measured } from "./measured";
import { OWN_FETCH_OPTS, OWN_FETCH_SOURCE, isStoredDocument, toStoredDocument, type StoredDocument } from "./own-fetch";
import { parseOnPage, visibleText, type OnPageFacts } from "./parse";
import type { Drivers } from "./score";

export type { Drivers } from "./score";
export { aiPresenceOf, answerabilityOf, classifyReferences, foundationsOf, ownRankedOf, searchPresenceOf, TOO_FEW_READ } from "./drivers";
export { parseOnPage, visibleText, type OnPageFacts } from "./parse";
export type { Measured, UnmeasuredReason } from "./measured";
export { BOT_PROTECTION, type ProtectionVendor } from "./challenge";

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
    a: { domain: string; rows: 50 | 100 | 300; locale: Locale; listing?: boolean; onFailure?: (failure: VendorFailure) => void }
  ) => Promise<Measured<RankedResult>>;
  /** The vendor's rendered read (SPEC §6, issue 1374), asked once for a home
   *  page whose plain read was a bot-protection page (SPEC §2, issue 1379).
   *  Absent, it is not asked. */
  renderedPage?: (c: CostContext, a: { url: string; freshnessDays: number }) => Promise<Measured<StoredDocument[]>>;
}

const DEFAULT_PORTS: MeasurePorts = Object.freeze({
  fetchDocument: safeFetch,
  readRobots,
  rankedKeywords,
  // Read off the module when it is asked for, so a suite that doubles the
  // vendor without this function still loads.
  renderedPage: async (c: CostContext, a: { url: string; freshnessDays: number }) =>
    (await import("@/lib/vendors/dataforseo")).renderedPage(c, a),
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
  /** The bot protection whose page was served in the document's place
   *  (SPEC §2, issue 1379); `null` where the site's own page was read. */
  protection: ProtectionVendor | null;
  /** An error or rate-limit answer in the document's place (issue 1427):
   *  its status, how long the server asked to be left, and whether this
   *  pass read it or the cache served it. `null` otherwise. */
  error: { status: number; retryAfterMs: number | null; fresh: boolean } | null;
}

/** A read document as its facts: `zero` when it parsed to nothing (no
 *  headings, no visible text — REQ-004 c7's "read it; it contained none"). */
function factsOf(document: StoredDocument, at: Date): Measured<OnPageFacts> {
  const facts = parseOnPage({ url: document.url, html: document.html });
  const isEmpty = facts.headings === 0 && facts.visibleChars === 0;
  return isEmpty ? measuredZero(facts, at) : measured(facts, at);
}

/** One own-document read, through `recordFetch` at zero cents so the bytes
 *  are ledgered under `OWN_FETCH_SOURCE`. Maps the outcome to the
 *  trichotomy once, here, so no call site invents a second mapping:
 *  `ok: false` → `undeterminable`; a cap-skip → `not_attempted`; a read
 *  document → `measured`, or `zero` when it parsed to nothing (no headings,
 *  no visible text — REQ-004 c7's "read it; it contained none"). */
async function readDocument(
  c: CostContext,
  ports: MeasurePorts,
  url: string,
  windowDays: number = CACHE_WINDOWS_D.own
): Promise<DocumentRead> {
  // The failed outcome is kept beside the ledgered refusal so its `readAt`
  // can date the `unmeasured` arm — the row stores the refusal, not a date.
  const stash: { failure: Extract<FetchOutcome, { ok: false }> | null } = { failure: null };
  const result = await c.recordFetch<StoredDocument | FetchRefusal>({
    source: OWN_FETCH_SOURCE,
    cacheKey: url,
    freshnessDays: windowDays,
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
    return { url, facts: unmeasured("not_attempted", EPOCH), html: null, at: EPOCH, refusal: null, protection: null, error: null };
  }
  const stored = result.payload;
  if (!isStoredDocument(stored)) {
    const at = stash.failure === null ? EPOCH : stash.failure.readAt;
    const refusal = isFetchRefusal(stored) ? stored.refusal : null;
    return { url, facts: unmeasured("undeterminable", at), html: null, at, refusal, protection: null, error: null };
  }
  const at = new Date(stored.readAt);
  // A bot-protection page is not the site's (issue 1379): nothing on it is
  // a fact of the site, so it is read as a page that could not be read.
  const protection = challengeOf(stored);
  if (protection !== null) {
    return { url, facts: unmeasured("undeterminable", at, BOT_PROTECTION), html: null, at, refusal: null, protection, error: null };
  }
  return { url, facts: factsOf(stored, at), html: stored.html, at, refusal: null, protection: null, error: errorOf(stored, result.fresh) };
}

/** The error answer `notTheSiteOf` reads in a document's place, if any. */
function errorOf(stored: StoredDocument, fresh: boolean): DocumentRead["error"] {
  const not = notTheSiteOf(stored);
  return not === null || not.kind !== "error" ? null : { status: not.status, retryAfterMs: not.retryAfterMs, fresh };
}

/**
 * The home page asked once more where it answered with an error or a rate
 * limit (SPEC §2, issue 1427): such an answer is no home document, and
 * nothing is read off it. The second read waits what the server asked
 * (`Retry-After`) where this pass met the answer itself, and none where
 * the cache served it; a server that asks for longer than
 * `HOME_RETRY.MAX_WAIT_MS` is not asked again inside this pass. An answer
 * that is still no document is a refused home: the site is unread and the
 * pass says so (issue 479), so no profile, market or brand is inferred
 * from it.
 */
async function readHomeAgain(c: CostContext, ports: MeasurePorts, first: DocumentRead): Promise<DocumentRead> {
  const error = first.error;
  if (error === null) return first;
  const waitMs = error.fresh ? (error.retryAfterMs ?? HOME_RETRY.WAIT_MS) : 0;
  let again: DocumentRead | null = null;
  if (waitMs <= HOME_RETRY.MAX_WAIT_MS) {
    if (waitMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    // A window of none: the answer just stored is not served back.
    again = await readDocument(c, ports, first.url, 0);
    if (again.error === null && !(again.facts.kind === "unmeasured" && again.facts.reason === "not_attempted")) return again;
  }
  const last = again?.error ?? error;
  logDriver("home_not_a_document", { status: last.status, retried: again !== null });
  return { ...first, facts: unmeasured("undeterminable", first.at), html: null, refusal: "status", error: last };
}

/** The home page as the vendor's browser draws it, asked once where the
 *  plain read was a bot-protection page (issue 1379). `null` where the
 *  vendor met the protection too, did not answer inside
 *  `CHALLENGE_RENDER_MS`, or the cap is spent. Never throws. */
async function renderedHome(c: CostContext, ports: MeasurePorts, url: string, windowDays: number): Promise<StoredDocument | null> {
  const ask = ports.renderedPage;
  if (ask === undefined || c.capHit()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const read = await Promise.race([
      ask(c, { url, freshnessDays: windowDays }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CHALLENGE_RENDER_MS);
      }),
    ]);
    const document = read === null || read.kind !== "measured" ? undefined : read.value[0];
    return document === undefined || challengeOf(document) !== null ? null : document;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Re-stamps a read's `at` to the pass's one date. The document's own
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
// The other supported languages name the same page in their own words (D66).
const PRICING_PATH_RE = new RegExp(`(?:^|/)(?:pricing|prices?|plans|${pagePathAlternation("pricing")})/?$`, "i");

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
   *  Whole, as the measurement read it: the profile prompt bounds its own
   *  copy (`PROFILE_INPUT_MAX_CHARS`, issue #523), never this.
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
  /** The rows that count was read from (#778) — SPEC §6's thin-market pool
   *  selects over the site's own ranked keywords without buying them again.
   *  Empty where the call was not made or did not answer. */
  ownRankedRows: readonly RankedRow[];
  /** The country and language this site is measured in (SPEC §6, owner D66,
   *  issue 1311): the caller's where it holds the founder's own answer, else
   *  the reading of the address and the home document. Every vendor read of
   *  the pass is made in it. */
  locale: Locale;
  /** What the site said of itself that is not measured, where the reading
   *  fell back to the nearest supported country in English; `null`
   *  otherwise, and wherever the locale was the caller's. */
  localeFellBack: ResolvedLocale["fellBack"];
  /** What the home page's structured data states of the business's address
   *  (SPEC §6, owner D67, issue 1318): evidence for where it serves. */
  stated?: PlaceSignals;
  /** Why the fetcher refused the home document, where it did (issue #479);
   *  `null` where it was read. A refused home is the whole site unread:
   *  nothing after it is attempted — no pricing page, no robots read, no
   *  priced call — and the pass ends `site_unreadable` (`src/lib/scan/
   *  run.ts`) rather than `complete`. */
  homeRefusal: FetchRefusalReason | null;
  /** The bot protection that answered the home page's plain read with a
   *  page of its own (SPEC §2, issue 1379); absent where the site answered.
   *  Where the vendor's rendered read then returned the site, `onPage` and
   *  `text` are that read's and `renderedHome` is its document; where it did
   *  not, the site's own pages are unmeasured and the vendor reads still
   *  run. */
  protection?: ProtectionVendor;
  /** The home document of the rendered read above, for the site profile:
   *  the crawl's own read of the home page would be the protection's. */
  renderedHome?: string;
}

/** Reads a domain — home document, detected pricing page, up to the tier's
 *  page allowance of `pages?`, robots policy, the customer's own ranked
 *  rows — and returns BUILD §5's four measured quantities with the facts
 *  the verdict rests on. Never throws for a domain that cannot be read:
 *  every failure is an `unmeasured` arm with its reason.
 *
 *  The home document is read first and alone — everything else depends on
 *  whether it could be read at all — and the reads that do not depend on
 *  each other then run concurrently (issue #539, see the body). */
export async function measureDomain(
  c: CostContext,
  a: {
    domain: string;
    /** The date of the pass, which every figure it computes carries: the
     *  moment it started (issue 1392), never the age of a stored read. */
    at: Date;
    tier: Tier;
    /** The site's stored country and language (D66): the founder's answer
     *  at setup, which wins over anything read. Absent on a free scan and
     *  on a site that has not answered, which are read from the address and
     *  the home document. */
    locale?: Locale;
    pages?: readonly string[];
    /** SPEC §6 (issue 1170): how old a stored read may be and still be this
     *  pass's own, so a weekly pass is served no read from the week before.
     *  Narrows
     *  the own window for the documents and the ranked rows; never widens
     *  it. Absent, the window is `CACHE_WINDOWS_D.own` as before. */
    ownWindowDays?: number;
  },
  ports: MeasurePorts = DEFAULT_PORTS
): Promise<DomainMeasurement> {
  const homeUrl = homeUrlOf(a.domain);
  const windowDays =
    a.ownWindowDays === undefined ? CACHE_WINDOWS_D.own : Math.min(CACHE_WINDOWS_D.own, a.ownWindowDays);

  const at = a.at;
  // 1. The home document. Its facts keep its own `readAt`, which is how
  //    `src/lib/scan/challenged.ts` finds the read a report was measured from.
  //    An error or rate-limit answer is asked once more (issue 1427).
  const plain = await readHomeAgain(c, ports, await readDocument(c, ports, homeUrl, windowDays));
  // 1'. A bot-protection page in its place: the vendor's browser is asked
  //     once (issue 1379). Its document is dated as the plain read is.
  const drawn = plain.protection === null ? null : await renderedHome(c, ports, homeUrl, windowDays);
  const home: DocumentRead = drawn === null ? plain : { ...plain, facts: factsOf(drawn, plain.at), html: drawn.html };
  if (plain.protection !== null) {
    logDriver("home_bot_protection", { domain: a.domain, protection: plain.protection, rendered: drawn !== null });
  }
  const guarded = {
    ...(plain.protection === null ? {} : { protection: plain.protection }),
    ...(drawn === null ? {} : { renderedHome: drawn.html }),
  };
  const onPage = home.facts;
  const read: ResolvedLocale =
    a.locale === undefined ? readLocale({ domain: a.domain, html: home.html }) : { locale: a.locale, fellBack: null };

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
      ownRankedRows: [],
      locale: read.locale,
      localeFellBack: read.fellBack,
      stated: readPlaceSignals(home.html),
      homeRefusal: home.refusal,
      ...guarded,
    };
  }

  // 2. The pricing page is named by the home document's own links, so its
  //    URL is decided here — synchronously, from bytes already in hand —
  //    before anything else is read.
  const pricingUrl = home.html === null ? null : detectPricingUrl(home.html, homeUrl);

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

  // 4–5. The reads that do not depend on each other, concurrently (issue
  //      #539).
  //
  // Nothing below the home document depends on anything else below it: the
  // pricing page and the caller's extra pages are other documents, the
  // robots policy is a different URL at the same origin, and
  // `ranked_keywords` is a vendor call about the domain that reads no
  // document at all. They were awaited one after another, so a slow robots
  // read delayed a priced call that had nothing to do with it, and
  // `reading_your_site` spent far more of the pass's ceiling than its work
  // needed — the serialised shape issue #539 names.
  //
  // **Concurrency here buys time and never money.** `recordFetch` sums the
  // reservations of every call in flight (`src/lib/costs/index.ts`), so the
  // cap is checked against all of them together; and the only priced call
  // of the four is the ranked rows, the other three being own-document
  // reads ledgered at zero cents, which cannot move a cap whatever order
  // they run in. That is also why `capHit()` read once at the start of the
  // ranked task below decides exactly what it decided when this was
  // sequential.
  //
  // The customer's own extra pages stay sequential *within* their own task:
  // they are one server, and asking it for twenty-five pages at once is a
  // load this product has no business putting on it.
  const [pricingRead, extraFacts, robots, presence] = await Promise.all([
    pricingUrl === null ? Promise.resolve(null) : readDocument(c, ports, pricingUrl, windowDays),

    (async (): Promise<Measured<OnPageFacts>[]> => {
      const facts: Measured<OnPageFacts>[] = [];
      for (const url of extra) facts.push(stampedAt((await readDocument(c, ports, url, windowDays)).facts, at));
      return facts;
    })(),

    // The robots policy at the origin. `absent` is a read with nothing in
    // it (the `zero` arm); a reader that cannot determine is
    // `undeterminable`.
    (async (): Promise<Measured<RobotsPolicy>> => {
      try {
        const policy = await ports.readRobots(new URL(homeUrl).origin);
        return !policy.ok
          ? unmeasured("undeterminable", at)
          : policy.absent
            ? measuredZero(policy, at)
            : measured(policy, at);
      } catch {
        return unmeasured("undeterminable", at);
      }
    })(),

    // The one priced call. `capHit()` first — the ceiling names itself in
    // the log and the call is not made (BUILD §6.5, BP-010 NFR budget).
    // The same rows are read two ways: the driver, and the count itself,
    // which §6.6's banding and §7's bars are expressed in multiples of.
    // Never a second call — both are returned from this one answer.
    (async (): Promise<{
      searchPresence: Measured<number>;
      ownRanked: Measured<number>;
      ownRankedRows: readonly RankedRow[];
    }> => {
      if (c.capHit()) {
        logDriver("driver_not_attempted", { driver: "searchPresence", ceiling: "spend_cap", domain: a.domain });
        return {
          searchPresence: unmeasured("not_attempted", at),
          ownRanked: unmeasured("not_attempted", at),
          ownRankedRows: [],
        };
      }
      // A failed call is ledgered as the failure and answers `unmeasured`
      // (issue #504); this is where the stage hears which failure it was, so
      // the reason it logs is the vendor's and never a ledger insert's.
      const heard: { failure: VendorFailure | null } = { failure: null };
      try {
        const ranked = await ports.rankedKeywords(c, {
          domain: a.domain,
          rows: RANKED_ROWS_BY_TIER[a.tier],
          locale: read.locale,
          ...(a.ownWindowDays === undefined ? {} : { windowDays }),
          // Issue 1387: a site whose own pages stay unread has its market
          // read from these rows, so they carry what Google shows for each.
          ...(plain.protection !== null && drawn === null ? { listing: true } : {}),
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
        // One answer, both readings: §5's reach and §6.6's own count are the
        // vendor's total (#117, #529); §5's top-10 share is over the rows
        // bought. `searchPresenceOf` takes the whole answer for that reason.
        return {
          searchPresence: searchPresenceOf({ ranked, at }),
          ownRanked: ownRankedOf({ ranked, at }),
          ownRankedRows: ranked.kind === "unmeasured" ? [] : ranked.value.rows,
        };
      } catch (error) {
        logDriver("driver_undeterminable", {
          driver: "searchPresence",
          domain: a.domain,
          because: error instanceof Error ? error.message : String(error),
        });
        return {
          searchPresence: unmeasured("undeterminable", at),
          ownRanked: unmeasured("undeterminable", at),
          ownRankedRows: [],
        };
      }
    })(),
  ]);

  const pricingHtml = pricingRead === null ? null : pricingRead.html;
  const pricing =
    pricingUrl === null || pricingRead === null
      ? null
      : { url: pricingUrl, facts: stampedAt(pricingRead.facts, at) };
  const { searchPresence, ownRanked, ownRankedRows } = presence;

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
    ownRankedRows,
    locale: read.locale,
    localeFellBack: read.fellBack,
    stated: readPlaceSignals(home.html),
    homeRefusal: null,
    ...guarded,
  };
}
