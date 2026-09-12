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
// is exhausted, when it has read `SITE_PROFILE.MAX_PAGES`, or when
// `SITE_PROFILE.CRAWL_MS` is spent — and it says which. What it returns is
// exactly what it read: a site of nine pages yields nine rows, and nothing
// is invented to reach a hundred (§2, and issue #577's own done-when).
import { CACHE_WINDOWS_D, SITE_PROFILE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { SafeFetchOpts } from "@/lib/egress/safe-fetch";
import { safeFetch } from "@/lib/egress/safe-fetch";
import type { FetchOutcome } from "@/lib/egress/types";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { visibleText } from "@/lib/measure/parse";
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
}

export interface CrawlOutcome {
  pages: readonly CrawledPage[];
  /** In-scope addresses found, whether or not they were read. The screen
   *  never shows this; it is what tells a reader of the ledger that a stop
   *  at the cap left pages behind rather than exhausting the site. */
  discovered: number;
  stoppedBy: "complete" | "page_cap" | "time_budget";
}

/** The one seam this module crosses. Doubled in tests; wired to the
 *  product's SSRF-safe fetcher everywhere else. */
export interface CrawlPorts {
  fetchDocument: (url: string, opts: SafeFetchOpts) => Promise<FetchOutcome>;
}

const DEFAULT_PORTS: CrawlPorts = {
  fetchDocument: (url, opts) => safeFetch(url, opts),
};

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
  const startedAt = Date.now();
  const deadline = startedAt + SITE_PROFILE.CRAWL_MS;
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
      ? { url: a.homeUrl, html: a.homeHtml }
      : await readHome(c, a.homeUrl, ports);
  if (home === null) return { pages: [], discovered: 0, stoppedBy: "complete" };

  const homeKey = dedupeKey(home.url);
  if (homeKey !== null) seen.add(homeKey);
  pages.push(pageOf(home.url, home.html));

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

  for (const url of await sitemapUrls(c, a, ports, deadline)) enqueue(url, home.url);
  for (const href of anchorHrefs(home.html)) enqueue(href, home.url);

  let stoppedBy: CrawlOutcome["stoppedBy"] = "complete";

  while (frontier.length > 0) {
    if (pages.length >= SITE_PROFILE.MAX_PAGES) {
      stoppedBy = "page_cap";
      break;
    }
    if (Date.now() >= deadline) {
      stoppedBy = "time_budget";
      break;
    }
    // Out of money: every further `recordFetch` would skip, so the crawl
    // stops reading and reports what it read. The pass's own bounds are
    // what decide whether the scan continues at all (`scan/ceilings.ts`);
    // this is only about not prefetching documents nothing will ledger.
    if (c.capHit()) break;

    const room = SITE_PROFILE.MAX_PAGES - pages.length;
    const batch = frontier.splice(0, Math.min(SITE_PROFILE.CONCURRENCY, room));

    // Phase one: the network, in parallel.
    const outcomes = await Promise.all(
      batch.map(async (url) => ({ url, outcome: await ports.fetchDocument(url, OWN_FETCH_OPTS) }))
    );

    // Phase two: the ledger, strictly one at a time (see the header).
    for (const { url, outcome } of outcomes) {
      const stored = await ledger(c, url, outcome);
      if (stored === null) continue;
      const page = pageOf(stored.url, stored.html);
      pages.push(page);
      for (const href of anchorHrefs(stored.html)) enqueue(href, stored.url);
    }
  }

  if (stoppedBy === "complete" && pages.length >= SITE_PROFILE.MAX_PAGES) stoppedBy = "page_cap";

  return { pages, discovered: seen.size, stoppedBy };
}

/** One own-document row, at zero cents under `OWN_FETCH_SOURCE` — the same
 *  shape `measureDomain` writes, so one reader serves both. A refusal and
 *  a cap-skip are both "no row", never a throw: a page that would not load
 *  is a page the inventory does not claim. */
async function ledger(
  c: CostContext,
  url: string,
  prefetched: FetchOutcome
): Promise<StoredDocument | null> {
  const result = await c.recordFetch<StoredDocument | { refused: true }>({
    source: OWN_FETCH_SOURCE,
    cacheKey: url,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    // The document is already in hand: `run` hands the ledger what phase
    // one fetched. It is called only on a cache miss, which is the
    // ordinary case for a crawl (see the header).
    run: async () => (prefetched.ok ? toStoredDocument(prefetched) : { refused: true }),
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
  ports: CrawlPorts
): Promise<{ url: string; html: string } | null> {
  const result = await c.recordFetch<StoredDocument | { refused: true }>({
    source: OWN_FETCH_SOURCE,
    cacheKey: homeUrl,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    run: async () => {
      const outcome = await ports.fetchDocument(homeUrl, OWN_FETCH_OPTS);
      return outcome.ok ? toStoredDocument(outcome) : { refused: true };
    },
  });
  if ("skipped" in result) return null;
  const stored = result.payload;
  return isStoredDocument(stored) ? { url: stored.url, html: stored.html } : null;
}

/** The site's own sitemaps: what `robots.txt` declared, plus the
 *  conventional address, plus one level of children where a document turns
 *  out to be an index. Every read is ledgered like any other own document.
 *  A site with no sitemap simply yields nothing here, and the internal-link
 *  walk is the whole of its discovery. */
async function sitemapUrls(
  c: CostContext,
  a: { homeUrl: string; sitemaps: readonly string[] },
  ports: CrawlPorts,
  deadline: number
): Promise<readonly string[]> {
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
  let index = 0;
  while (index < queue.length) {
    if (Date.now() >= deadline) break;
    const url = queue[index++];
    if (url === undefined) break;

    const outcome = await ports.fetchDocument(url, OWN_FETCH_OPTS);
    const stored = await ledger(c, url, outcome);
    if (stored === null) continue;

    const locs = locElements(stored.html);
    if (SITEMAP_INDEX_RE.test(stored.html)) {
      for (const child of locs) push(child);
      continue;
    }
    for (const loc of locs) found.push(loc);
  }
  return found;
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

/** The identity two addresses share when they are the same page: scheme
 *  and host lower-cased by the URL parser, no fragment, no query, no
 *  trailing slash below the root. The query goes because a crawl that read
 *  `/blog?page=1` and `/blog?page=1&utm=x` twice would spend two of its
 *  hundred on one page. */
function dedupeKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${path === "" ? "/" : path}`;
}

/** One read page, parsed. Never throws: a document that carries no title
 *  and no `h1` yields empty strings, which is the truth about it. */
function pageOf(url: string, html: string): CrawledPage {
  return {
    url,
    title: firstText(html, TITLE_RE),
    h1: firstText(html, H1_RE),
    text: visibleText(html).slice(0, SITE_PROFILE.PAGE_SAMPLE_CHARS),
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
