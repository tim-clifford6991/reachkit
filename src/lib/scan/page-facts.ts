// src/lib/scan/page-facts.ts — what the re-score reads off one stored page
// read (`fetches.payload`), derived once and kept in `fetch_facts`, so a
// scoring deploy scores from these and downloads no page twice. Every value
// here is what `rescore.ts`, `own-reads.ts` and `challenged.ts` would derive
// from the read's `html`; `scripts/derivation.mjs` fingerprints this module
// as `RK_FACTS_VERSION`, so a change to how they are derived reads the pages
// again.
import { servedSignalsOf, type ServedSignals } from "@/lib/locale/read";
import type { Measured } from "@/lib/measure/measured";
import { isStoredDocument, renderedDocumentOf, siteDocumentOf } from "@/lib/measure/own-fetch";
import { detectPricingUrl, storedFactsOf } from "@/lib/measure/pages";
import type { OnPageFacts } from "@/lib/measure/parse";
import { protectionPage } from "./challenged";

type Undated<M> = M extends unknown ? Omit<M, "at"> : never;

/** One stored read's facts. A read that is no stored document says so in
 *  `document`, and carries no facts of a page. */
export interface PageFacts {
  url: string | null;
  status: number | null;
  readAt: string | null;
  bytes: number | null;
  /** `isStoredDocument`. */
  document: boolean;
  /** The site's own page, and not a sitemap or a feed the crawl read. */
  page: boolean;
  /** A rendered read's row that drew the site (`renderedDocumentOf`). */
  drawn: boolean;
  /** `protectionPage`. */
  protection: boolean;
  /** `storedFactsOf`, without the date the re-score gives it. */
  onPage: Undated<Measured<OnPageFacts>>;
  /** `detectPricingUrl` against the address the read was stored under. */
  pricingUrl: string | null;
  /** `servedSignalsOf` against that address; `null` where no document. */
  served: ServedSignals | null;
}

/** A sitemap or feed is a document the crawl read, not a page of the site. */
const NOT_A_PAGE_RE = /^\s*(?:<\?xml|<urlset|<sitemapindex|<rss|<feed)/i;

function field<T>(payload: unknown, name: string, type: "string" | "number"): T | null {
  const value = payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>)[name] : undefined;
  return typeof value === type ? (value as T) : null;
}

/** The facts of the read stored under `key` (`fetches.cache_key`). */
export function pageFactsOf(key: string, payload: unknown): PageFacts {
  const document = isStoredDocument(payload);
  const site = siteDocumentOf(payload);
  const onPage: Partial<Measured<OnPageFacts>> = storedFactsOf(payload, new Date(0));
  delete onPage.at;
  let host: string | null = null;
  try {
    host = new URL(key).hostname;
  } catch {
    // An address no URL parses has no home to read links against.
  }
  return {
    url: field(payload, "url", "string"),
    status: field(payload, "status", "number"),
    readAt: field(payload, "readAt", "string"),
    bytes: field(payload, "bytes", "number"),
    document,
    page: site !== null && !NOT_A_PAGE_RE.test(site.html),
    drawn: renderedDocumentOf(payload) !== null,
    protection: protectionPage(payload),
    onPage: onPage as PageFacts["onPage"],
    pricingUrl: document ? detectPricingUrl(payload.html, key) : null,
    served: document && host !== null ? servedSignalsOf({ domain: host, html: payload.html }) : null,
  };
}

/** The read's on-page facts, dated `at` as `storedFactsOf` dates them. */
export function onPageOf(facts: PageFacts, at: Date): Measured<OnPageFacts> {
  return { ...facts.onPage, at } as Measured<OnPageFacts>;
}
