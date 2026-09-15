// SPEC.md §2 Rules ("The scan builds the site profile") · §12 ruling 8
// (2026-09-12) — "up to 100 pages read from the sitemap and internal
// links", "Bounded: 100 pages, one run per scan, inside the existing
// egress caps and the 12¢ ceiling".
//
// The bounded read of a customer's own site. It discovers addresses, reads
// documents, and returns what it read; it stores nothing, decides nothing
// about what a page is for (`purpose.ts`) and asks no model (`summary.ts`).
//
// **Both discovery routes, not one.** §12 ruling 8 names the sitemap *and*
// internal links, and the ruling's alternative — reading only pages we
// already hold — is what it was made to replace. A site with a sitemap is
// read from its own declaration of itself, which is the best list there
// is; a site with none is read by walking its links from the home page,
// and that arm is a done-when box of its own (issue #577). Both feed one
// frontier, sitemap first: a page the site itself lists outranks one this
// crawl inferred from an anchor.
//
// **Every read is ledgered, and every read is free.** Own documents go
// through `recordFetch` at zero cents under `OWN_FETCH_SOURCE`, exactly as
// `measureDomain`'s own reads do — the bytes land in `fetches` (the cache
// and raw store) and the 12¢ ceiling is untouched, which is how a
// hundred-page crawl fits a lead magnet's budget at all.
//
// **Concurrency, against a seam that forbids it.** `src/lib/costs/index.ts`
// records a sequential-calls assumption: it tracks one in-flight
// reservation at a time, and a caller that fanned `recordFetch` out
// concurrently would race that slot. A hundred documents read strictly one
// at a time would not fit `SITE_PROFILE.CRAWL_MS` at the fetcher's own
// timeout. So the two are separated: a batch is fetched through the port
// concurrently, then each outcome is ledgered **sequentially**, each
// `recordFetch` awaited before the next begins. The ledger's contract is
// kept as written and the network time is spent in parallel.
//
// The price of that split is honest and small: `recordFetch` is
// cache-first, so a document already in the window is served from the
// ledger and the prefetch that ran beside it was wasted work. Inside one
// pass no page is fetched twice (the frontier dedupes), and between passes
// the windows are the free re-scan's seven days (§2) and the weekly
// refresh's own week — so the wasted case is rare by construction, and
// paying for it is cheaper than a lock around a seam this module does not
// own.
//
// **Stopping is a fact, not a failure.** The crawl ends when the frontier
// is exhausted, when it has read `SITE_PROFILE.MAX_PAGES`, when it has held
// `SITE_PROFILE.CRAWL_MAX_BYTES`, or when `SITE_PROFILE.CRAWL_MS` is spent —
// and it says which. What it returns is exactly what it read: a site of nine
// pages yields nine rows, and nothing is invented to reach a hundred (§2,
// and issue #577's own done-when).
//
// **The site's own rules, and three hard bounds** (master ruling under SPEC
// §5, 2026-09-12, issue 610). A path the site's `robots.txt` disallows is
// never read, and its `Crawl-delay` paces the reads, capped at
// `SITE_PROFILE.CRAWL_DELAY_MAX_MS`. The byte bound is strict: each read in
// a batch may hold only its share of what is left, so the batch together
// can never pass it. The time bound is enforced, not merely checked
// between batches: at `CRAWL_MS` every read still in flight is aborted and
// the crawl returns what it has.
import { CACHE_WINDOWS_D, SITE_PROFILE } from "@/lib/config/constants";
import { refusalOf, type CostContext, type FetchRefusal } from "@/lib/costs";
import { crawlDelayMs, readRobots, robotsAllows } from "@/lib/egress/robots";
import type { SafeFetchOpts } from "@/lib/egress/safe-fetch";
import { robotsTokensFor, safeFetch } from "@/lib/egress/safe-fetch";
import type { FetchOutcome, RobotsPolicy } from "@/lib/egress/types";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { visibleText } from "@/lib/measure/parse";
import { readPageFacts, type PageIssueFacts } from "@/lib/site-issues/facts";
import {
  isStoredDocument,
  OWN_FETCH_OPTS,
  OWN_FETCH_SOURCE,
  toStoredDocument,
  type StoredDocument,
} from "@/lib/measure/own-fetch";

/** One page the crawl read, before anything is decided about it. `text` is
 *  the page's visible text, cut to `SITE_PROFILE.PAGE_SAMPLE_CHARS` — the
 *  voice prompt's share of one page, never the whole document. */
export interface CrawledPage {
  url: string;
  title: string;
  h1: string;
  text: string;
  /** What SPEC §9's technical-issue checks read off this page. */
  facts: PageIssueFacts;
  /** The in-scope pages this page links to, as crawl identities
   *  (`dedupeKey`), once each. */
  links: readonly string[];
  /** How long this crawl's own fetch of the document took, or `null` where
   *  no fetch was timed (a document handed over or served from the cache). */
  fetchMs: number | null;
}

export interface CrawlOutcome {
  pages: readonly CrawledPage[];
  /** In-scope addresses found, whether or not they were read. The screen
   *  never shows this; it is what tells a reader of the ledger that a stop
   *  at the cap left pages behind rather than exhausting the site. */
  discovered: number;
  stoppedBy: "complete" | "page_cap" | "byte_cap" | "time_budget";
  /** Every in-scope address this crawl fetched, read or not, by identity. */
  fetched: readonly string[];
  /** The fetched addresses that answered with an HTTP error (4xx/5xx). A
   *  timeout or a refusal is not a broken page and is in neither list. */
  broken: readonly string[];
  /** Whether the site declares a sitemap this crawl could read. `absent` is
   *  a read with nothing in it (a 404, or a document with no `<loc>`);
   *  `unreadable` is a read that did not come back. */
  sitemap: "found" | "absent" | "unreadable";
  /** The home document this crawl read, handed over or cache-first, so the
   *  profile reads the published site name off it on every tier (issue
   *  609). `null` where the home page could not be read. */
  homeHtml: string | null;
}

/** The two seams this module crosses. Doubled in tests; wired to the
 *  product's SSRF-safe fetcher and its robots reader everywhere else.
 *  `readRobots` is memoised per scan, so asking it per origin here costs
 *  the fetch `safeFetch` already made. */
export interface CrawlPorts {
  fetchDocument: (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;
  readRobots: (origin: string) => Promise<RobotsPolicy | { ok: false; reason: string }>;
}

const DEFAULT_PORTS: CrawlPorts = {
  fetchDocument: (url, opts) => safeFetch(url, opts),
  readRobots: (origin) => readRobots(origin),
};

/** The names the crawl's own `User-Agent` answers to in a `robots.txt`. */
const ROBOTS_TOKENS = robotsTokensFor(OWN_FETCH_OPTS.userAgent);

/** How many sitemap documents one crawl will read: the site's own
 *  declarations from `robots.txt`, plus the conventional address, plus one
 *  level of children where those turn out to be a sitemap index. Bounded
 *  here rather than pinned in `constants.ts` because it is this module's
 *  own discovery budget and no customer promise is stated over it: a site
 *  whose index lists forty child sitemaps still has a hundred-page bound,
 *  and the frontier is full long before the tenth child is read. */
const MAX_SITEMAP_DOCUMENTS = 8;

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;
const ANCHOR_HREF_RE = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;
const LOC_RE = /<loc>\s*([\s\S]*?)\s*<\/loc>/gi;
const SITEMAP_INDEX_RE = /<sitemapindex\b/i;
const TAG_RE = /<[^>]*>/g;

/** Addresses that are not pages. A crawl that fetched these would spend
 *  its budget on bytes no inventory row can be made from. */
const ASSET_EXTENSION_RE =
  /\.(?:jpe?g|png|gif|svg|webp|avif|ico|bmp|tiff?|css|js|mjs|json|xml|rss|atom|pdf|zip|gz|tar|rar|7z|mp[34]|m4[av]|wav|ogg|webm|mov|avi|woff2?|ttf|otf|eot|docx?|xlsx?|pptx?|csv|dmg|exe|apk)$/i;

/**
 * Reads up to `SITE_PROFILE.MAX_PAGES` pages of one site, once.
 *
 * `homeHtml` is the home document the measurement pass already fetched and
 * ledgered: it is row one and is never read a second time. `sitemaps` are
 * the declarations `robots.txt` carried, which `readRobots` parses and
 * nothing has ever fetched until now.
 */
export async function crawlSite(
  c: CostContext,
  a: { domain: string; homeUrl: string; homeHtml: string | null; sitemaps: readonly string[] },
  ports: CrawlPorts = DEFAULT_PORTS
): Promise<CrawlOutcome> {
  const reader = new BoundedReader(ports, Date.now() + SITE_PROFILE.CRAWL_MS);
  try {
    return await crawl(c, a, reader);
  } finally {
    reader.close();
  }
}

async function crawl(
  c: CostContext,
  a: { domain: string; homeUrl: string; homeHtml: string | null; sitemaps: readonly string[] },
  reader: BoundedReader
): Promise<CrawlOutcome> {
  const site = registrableDomain(a.domain);

  const seen = new Set<string>();
  const pages: CrawledPage[] = [];

  // Row one, and the whole of a sitemap-less site's discovery, is the home
  // document. The caller hands it over where it already holds the markup;
  // where it does not — the measurement pass carries the home page's
  // *rendered text*, not its HTML, and the document itself is private to
  // `src/lib/measure` — this reads it cache-first under the very key that
  // pass ledgered it with, so the ordinary path is a cache hit that costs
  // nothing and touches no network.
  //
  // A home document that cannot be read at all ends the crawl with no
  // pages. The pass must not fail because a profile could not be built:
  // an unreadable home page is already the scan's own `site_unreadable`
  // ending (§2), and this returns the empty fact rather than throwing a
  // second one on top of it.
  const home =
    a.homeHtml !== null && a.homeHtml !== ""
      ? { url: a.homeUrl, html: a.homeHtml, fetchMs: null }
      : await readHome(c, a.homeUrl, reader);
  if (home === null) {
    return {
      pages: [],
      discovered: 0,
      stoppedBy: "complete",
      fetched: [],
      broken: [],
      sitemap: "unreadable",
      homeHtml: null,
    };
  }
  // The home document is held like any other, whoever fetched it.
  reader.hold(Buffer.byteLength(home.html, "utf8"));

  // The site's pace, from the home origin's own document.
  await reader.paceBy(home.url);

  const fetched = new Set<string>();
  const broken = new Set<string>();
  // The identities that already have a row, by the address the document was
  // finally served from — one row per real page, however many addresses
  // redirect to it (issue 609).
  const rows = new Set<string>();
  const homeKey = dedupeKey(home.url);
  if (homeKey !== null) {
    seen.add(homeKey);
    fetched.add(homeKey);
    rows.add(homeKey);
  }
  pages.push(pageOf(home.url, home.html, site, home.fetchMs));

  // The frontier, in discovery order: the site's own sitemap first, then
  // the home document's links, then each read page's links behind them.
  const frontier: string[] = [];
  const enqueue = (raw: string, from: string): void => {
    const url = inScopeUrl(raw, from, site);
    if (url === null) return;
    const key = dedupeKey(url);
    if (key === null || seen.has(key)) return;
    seen.add(key);
    frontier.push(url);
  };

  const sitemap = await sitemapUrls(c, a, reader);
  for (const url of sitemap.urls) enqueue(url, home.url);
  for (const href of anchorHrefs(home.html)) enqueue(href, home.url);

  let stoppedBy: CrawlOutcome["stoppedBy"] = "complete";
  // A page refused only because its share of a batch's bytes was too small
  // for it is read again alone, with the whole of what is left. Only if it
  // does not fit that either has the byte bound stopped the crawl.
  const alone: string[] = [];

  while (frontier.length > 0 || alone.length > 0) {
    if (pages.length >= SITE_PROFILE.MAX_PAGES) {
      stoppedBy = "page_cap";
      break;
    }
    if (reader.expired()) {
      stoppedBy = "time_budget";
      break;
    }
    if (reader.bytesLeft() <= 0) {
      stoppedBy = "byte_cap";
      break;
    }
    // Out of money: every further `recordFetch` would skip, so the crawl
    // stops reading and reports what it read. The pass's own bounds are
    // what decide whether the scan continues at all (`scan/ceilings.ts`);
    // this is only about not prefetching documents nothing will ledger.
    if (c.capHit()) break;

    const room = SITE_PROFILE.MAX_PAGES - pages.length;
    const candidates =
      alone.length > 0 ? alone.splice(0, 1) : frontier.splice(0, Math.min(reader.concurrency(), room));

    // A path the site's robots.txt disallows is never read (issue 610). It
    // stays discovered — it is the site's page — and is not fetched.
    const batch: string[] = [];
    for (const url of candidates) {
      if (await reader.allows(url)) batch.push(url);
    }
    if (batch.length === 0) continue;

    // Phase one: the network, in parallel, each read held to its share of
    // the bytes left and aborted at the deadline.
    const share = Math.floor(reader.bytesLeft() / batch.length);
    const outcomes = await Promise.all(batch.map((url) => reader.read(url, share)));

    // Phase two: the ledger, strictly one at a time (see the header).
    for (const { url, outcome, fetchMs } of outcomes) {
      // A read the crawl itself cut short — at its deadline, or at its share
      // of the byte bound — is a fact about this crawl, not about the page,
      // and is neither ledgered nor counted.
      if (outcome === "aborted") {
        stoppedBy = "time_budget";
        continue;
      }
      if (!outcome.ok && outcome.reason === "too_large" && share < OWN_FETCH_OPTS.maxBytes) {
        if (batch.length > 1) alone.push(url);
        else stoppedBy = "byte_cap";
        continue;
      }
      const key = dedupeKey(url);
      const stored = await ledger(c, url, outcome);
      if (stored === null) {
        if (key !== null && isHttpError(outcome)) {
          fetched.add(key);
          broken.add(key);
        }
        continue;
      }
      if (key !== null) fetched.add(key);
      // A redirect decides which page this is. A final address off the
      // customer's own site is not their page, and a final address that
      // already has a row is an alias of it: neither is a second row.
      const final = inScopeUrl(stored.url, stored.url, site);
      const finalKey = final === null ? null : dedupeKey(final);
      if (finalKey === null || rows.has(finalKey)) continue;
      rows.add(finalKey);
      seen.add(finalKey);
      // A document the ledger served from its window was not this fetch's
      // bytes, so this fetch's time is not its time.
      const timed = outcome.ok && outcome.readAt.toISOString() === stored.readAt ? fetchMs : null;
      const page = pageOf(stored.url, stored.html, site, timed);
      pages.push(page);
      for (const href of anchorHrefs(stored.html)) enqueue(href, stored.url);
    }
    if (stoppedBy !== "complete") break;
  }

  if (stoppedBy === "complete" && pages.length >= SITE_PROFILE.MAX_PAGES) stoppedBy = "page_cap";

  return {
    pages,
    discovered: seen.size,
    stoppedBy,
    fetched: [...fetched],
    broken: [...broken],
    sitemap: sitemap.state,
    homeHtml: home.html,
  };
}

/**
 * Every network read the crawl makes, under its three bounds: the deadline
 * (enforced by aborting), the byte budget (enforced by each read's
 * `maxBytes`) and the site's own `Crawl-delay` (enforced by pacing).
 *
 * One instance per crawl. `close()` clears the deadline's timer.
 */
class BoundedReader {
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly policies = new Map<string, Promise<RobotsPolicy | null>>();
  private held = 0;
  private delayMs = 0;
  private lastReadAt: number | null = null;

  constructor(
    private readonly ports: CrawlPorts,
    private readonly deadline: number
  ) {
    this.timer = setTimeout(() => this.controller.abort(), Math.max(0, deadline - Date.now()));
  }

  close(): void {
    clearTimeout(this.timer);
  }

  expired(): boolean {
    return this.controller.signal.aborted || Date.now() >= this.deadline;
  }

  bytesLeft(): number {
    return SITE_PROFILE.CRAWL_MAX_BYTES - this.held;
  }

  hold(bytes: number): void {
    this.held += bytes;
  }

  /** A site that asks for a delay is read one document at a time. */
  concurrency(): number {
    return this.delayMs > 0 ? 1 : SITE_PROFILE.CONCURRENCY;
  }

  /** Adopts the `Crawl-delay` the document at this address's origin asks
   *  of this reader, capped. */
  async paceBy(url: string): Promise<void> {
    const policy = await this.policyFor(url);
    if (policy === null) return;
    this.delayMs = Math.min(crawlDelayMs(policy, ROBOTS_TOKENS), SITE_PROFILE.CRAWL_DELAY_MAX_MS);
  }

  /** Whether the site's robots.txt lets this reader fetch the address. A
   *  document that could not be read decides nothing — `safeFetch`'s own
   *  rule — so the address is allowed. */
  async allows(url: string): Promise<boolean> {
    const policy = await this.policyFor(url);
    if (policy === null) return true;
    const parsed = new URL(url);
    return robotsAllows(policy, ROBOTS_TOKENS, `${parsed.pathname}${parsed.search}`);
  }

  /** One read, held to `maxBytes` and to the deadline. Answers `"aborted"`
   *  when the deadline ended it (or came before it started), whether or not
   *  the port itself honoured the signal. */
  async read(
    url: string,
    maxBytes: number = this.bytesLeft()
  ): Promise<{ url: string; outcome: FetchOutcome | "aborted"; fetchMs: number }> {
    await this.pace();
    const began = Date.now();
    if (this.expired() || maxBytes <= 0) {
      return { url, outcome: this.expired() ? "aborted" : this.overBudget(url), fetchMs: 0 };
    }
    this.lastReadAt = began;
    const outcome = await this.untilDeadline(
      this.ports.fetchDocument(url, {
        ...OWN_FETCH_OPTS,
        maxBytes: Math.min(OWN_FETCH_OPTS.maxBytes, maxBytes),
        signal: this.controller.signal,
      })
    );
    if (outcome !== "aborted" && outcome.ok) this.hold(outcome.bytes);
    return { url, outcome, fetchMs: Date.now() - began };
  }

  private overBudget(url: string): FetchOutcome {
    return { ok: false, reason: "too_large", url, readAt: new Date() };
  }

  private async pace(): Promise<void> {
    if (this.delayMs <= 0 || this.lastReadAt === null) return;
    const wait = this.lastReadAt + this.delayMs - Date.now();
    if (wait <= 0) return;
    await this.untilDeadline(new Promise<void>((resolve) => setTimeout(resolve, wait)));
  }

  private policyFor(url: string): Promise<RobotsPolicy | null> {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return Promise.resolve(null);
    }
    let policy = this.policies.get(origin);
    if (policy === undefined) {
      policy = this.untilDeadline(this.ports.readRobots(origin))
        .then((answer) => (answer === "aborted" || !answer.ok ? null : answer))
        .catch(() => null);
      this.policies.set(origin, policy);
    }
    return policy;
  }

  private untilDeadline<T>(work: Promise<T>): Promise<T | "aborted"> {
    const signal = this.controller.signal;
    if (signal.aborted) return Promise.resolve("aborted");
    let onAbort: () => void = () => {};
    const aborted = new Promise<"aborted">((resolve) => {
      onAbort = () => resolve("aborted");
      signal.addEventListener("abort", onAbort, { once: true });
    });
    return Promise.race([work, aborted]).finally(() => signal.removeEventListener("abort", onAbort));
  }
}

/** An answer from the site's own server that the page is not there or
 *  failed — the one refusal a link can be called broken for. */
function isHttpError(outcome: FetchOutcome): boolean {
  return !outcome.ok && outcome.reason === "status" && outcome.status !== undefined && outcome.status >= 400;
}

/** One own-document row, at zero cents under `OWN_FETCH_SOURCE` — the same
 *  shape `measureDomain` writes, so one reader serves both. A refusal and
 *  a cap-skip are both "no row", never a throw: a page that would not load
 *  is a page the inventory does not claim.
 *
 *  A failure is ledgered as `refusalOf`'s row, which is the shape
 *  `costs/cache.ts` refuses to serve back: this key is the measurement
 *  pass's own, and a crawl-time refusal must not negative-cache it for the
 *  window (BUILD §6.4 — no negative cache). */
async function ledger(
  c: CostContext,
  url: string,
  prefetched: FetchOutcome
): Promise<StoredDocument | null> {
  const result = await c.recordFetch<StoredDocument | FetchRefusal>({
    source: OWN_FETCH_SOURCE,
    cacheKey: url,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    // The document is already in hand: `run` hands the ledger what phase
    // one fetched. It is called only on a cache miss, which is the
    // ordinary case for a crawl (see the header).
    run: async () => (prefetched.ok ? toStoredDocument(prefetched) : refusalOf(prefetched)),
  });
  if ("skipped" in result) return null;
  return isStoredDocument(result.payload) ? result.payload : null;
}

/** The home document, cache-first. The sibling of `ledger` above, and
 *  separate from it on purpose: that one ledgers a document already in
 *  hand (the crawl's batches are fetched before they are ledgered), while
 *  this one hands `recordFetch` a `run` that fetches **only on a miss** —
 *  which is what makes the ordinary path free. The key and the window are
 *  the measurement pass's own, so its stored home document is exactly what
 *  comes back. `null` where it could not be read at all. */
async function readHome(
  c: CostContext,
  homeUrl: string,
  reader: BoundedReader
): Promise<{ url: string; html: string; fetchMs: number | null } | null> {
  let fetchMs: number | null = null;
  const result = await c.recordFetch<StoredDocument | FetchRefusal>({
    source: OWN_FETCH_SOURCE,
    cacheKey: homeUrl,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    run: async () => {
      const read = await reader.read(homeUrl);
      fetchMs = read.fetchMs;
      // A read the deadline ended is not a fact about the home page; the
      // refusal row is still the one shape the cache never serves back.
      const outcome: FetchOutcome =
        read.outcome === "aborted"
          ? { ok: false, reason: "timeout", url: homeUrl, readAt: new Date() }
          : read.outcome;
      // A refusal here is the measurement pass's home key: `refusalOf`'s
      // row is the shape the cache never serves back (BUILD §6.4).
      return outcome.ok ? toStoredDocument(outcome) : refusalOf(outcome);
    },
  });
  if ("skipped" in result) return null;
  const stored = result.payload;
  return isStoredDocument(stored) ? { url: stored.url, html: stored.html, fetchMs } : null;
}

/** The site's own sitemaps: what `robots.txt` declared, plus the
 *  conventional address, plus one level of children where a document turns
 *  out to be an index. Every read is ledgered like any other own document.
 *  A site with no sitemap simply yields nothing here, and the internal-link
 *  walk is the whole of its discovery. */
async function sitemapUrls(
  c: CostContext,
  a: { homeUrl: string; sitemaps: readonly string[] },
  reader: BoundedReader
): Promise<{ urls: readonly string[]; state: CrawlOutcome["sitemap"] }> {
  const queue: string[] = [];
  const requested = new Set<string>();
  const push = (url: string): void => {
    if (requested.has(url) || requested.size >= MAX_SITEMAP_DOCUMENTS) return;
    requested.add(url);
    queue.push(url);
  };

  for (const declared of a.sitemaps) push(declared);
  const conventional = absoluteUrl("/sitemap.xml", a.homeUrl);
  if (conventional !== null) push(conventional);

  const found: string[] = [];
  let declaresOne = false;
  let unreadable = false;
  let index = 0;
  while (index < queue.length) {
    if (reader.expired() || reader.bytesLeft() <= 0) break;
    const url = queue[index++];
    if (url === undefined) break;

    const { outcome } = await reader.read(url);
    if (outcome === "aborted") {
      index--;
      break;
    }
    const stored = await ledger(c, url, outcome);
    if (stored === null) {
      // A 404 or 410 is a plain "no sitemap here". Anything else — a
      // timeout, a refusal, a server error — is a read that did not come
      // back, and says nothing about whether one exists.
      const gone = !outcome.ok && outcome.reason === "status" && (outcome.status === 404 || outcome.status === 410);
      if (!gone) unreadable = true;
      continue;
    }

    const locs = locElements(stored.html);
    if (SITEMAP_INDEX_RE.test(stored.html)) {
      if (locs.length > 0) declaresOne = true;
      for (const child of locs) push(child);
      continue;
    }
    if (locs.length > 0) declaresOne = true;
    for (const loc of locs) found.push(loc);
  }
  // A deadline or the byte bound that cut the queue short leaves addresses
  // unread.
  if (index < queue.length) unreadable = true;
  const state: CrawlOutcome["sitemap"] = declaresOne ? "found" : unreadable ? "unreadable" : "absent";
  return { urls: found, state };
}

/** `<loc>` values, in document order. */
function locElements(xml: string): readonly string[] {
  const out: string[] = [];
  LOC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LOC_RE.exec(xml)) !== null) {
    const value = decodeEntities((match[1] ?? "").trim());
    if (value.length > 0) out.push(value);
  }
  return out;
}

/** Anchor `href`s, in document order, raw. Scope is decided by the caller
 *  so one rule serves sitemap entries and links alike. */
function anchorHrefs(html: string): readonly string[] {
  const out: string[] = [];
  ANCHOR_HREF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANCHOR_HREF_RE.exec(html)) !== null) {
    const href = (match[1] ?? match[2] ?? "").trim();
    if (href.length > 0) out.push(decodeEntities(href));
  }
  return out;
}

/** An address this crawl may read: absolute, http(s), on the customer's
 *  own registrable domain, and not an asset. Anything else is `null` — a
 *  rival's site, a `mailto:`, a PDF, a `javascript:` handle. */
function inScopeUrl(raw: string, from: string, site: string | null): string | null {
  const absolute = absoluteUrl(raw, from);
  if (absolute === null) return null;

  let parsed: URL;
  try {
    parsed = new URL(absolute);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (ASSET_EXTENSION_RE.test(parsed.pathname)) return null;
  if (site === null || registrableDomain(parsed.hostname) !== site) return null;

  parsed.hash = "";
  return parsed.toString();
}

function absoluteUrl(raw: string, from: string): string | null {
  if (raw.startsWith("#") || /^(?:mailto|tel|javascript|data):/i.test(raw)) return null;
  try {
    return new URL(raw, from).toString();
  } catch {
    return null;
  }
}

/** Query parameters that track a click and never address a page. */
const TRACKING_PARAM_RE = /^(?:utm_.*|gclid|fbclid|msclkid)$/i;

/** The identity two addresses share when they are the same page: scheme
 *  and host lower-cased by the URL parser, no fragment, no trailing slash
 *  below the root, and the query without its tracking parameters, sorted.
 *  The query stays because `/product?id=1` and `/product?id=2` are two
 *  pages (issue 609); the tracking parameters go because a crawl that read
 *  `/blog?page=1` and `/blog?page=1&utm_source=x` twice would spend two of
 *  its hundred on one page. */
function dedupeKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  for (const name of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM_RE.test(name)) parsed.searchParams.delete(name);
  }
  parsed.searchParams.sort();
  const query = parsed.searchParams.toString();
  return `${parsed.protocol}//${parsed.host}${path === "" ? "/" : path}${query === "" ? "" : `?${query}`}`;
}

/** One read page, parsed. Never throws: a document that carries no title
 *  and no `h1` yields empty strings, which is the truth about it. */
function pageOf(url: string, html: string, site: string | null, fetchMs: number | null): CrawledPage {
  const links = new Set<string>();
  for (const href of anchorHrefs(html)) {
    const target = inScopeUrl(href, url, site);
    const key = target === null ? null : dedupeKey(target);
    if (key !== null) links.add(key);
  }
  const own = dedupeKey(url);
  if (own !== null) links.delete(own);
  return {
    url,
    title: firstText(html, TITLE_RE),
    h1: firstText(html, H1_RE),
    text: visibleText(html).slice(0, SITE_PROFILE.PAGE_SAMPLE_CHARS),
    facts: readPageFacts(url, html),
    links: [...links],
    fetchMs,
  };
}

function firstText(html: string, re: RegExp): string {
  const match = re.exec(html);
  if (match === null) return "";
  return decodeEntities((match[1] ?? "").replace(TAG_RE, " ")).replace(/\s+/g, " ").trim();
}

/** The five named entities a heading or an address realistically carries,
 *  plus numeric references. Not a general HTML parser: this module reads
 *  addresses and two headings, and a dependency for that would be a
 *  dependency added without asking. */
function decodeEntities(value: string): string {
  return value
    .replace(/&(?:amp|AMP);/g, "&")
    .replace(/&(?:lt|LT);/g, "<")
    .replace(/&(?:gt|GT);/g, ">")
    .replace(/&(?:quot|QUOT);/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d{1,6});/g, (_whole, code: string) => String.fromCodePoint(Number(code)));
}
