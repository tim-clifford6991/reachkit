// SPEC §6 — renderedPage: one page of a customer's own site as a browser draws it.
// ReachKit runs no browser, so a JavaScript shell reads as empty; On-Page *instant pages* renders it and *raw HTML* returns
// the result, which `@/lib/measure/prose` reads like any own document.
// The second request only fetches the first's answer and is free, so the pair is one ledgered call at `RENDERED_PAGE_C`.
// Live only: the knowledge-base step waits for it. A page that did not answer 200 with HTML is the uncached zero-result.
import { OWN_DOCUMENT_MAX_BYTES, PRICE_BOOK } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Measured } from "@/lib/measure/measured";
import { RENDERED_FETCH_SOURCE, type StoredDocument } from "@/lib/measure/own-fetch";
import { asArray, asNumber, asString, callEndpoint, isRecord, ledgered, type EndpointPaths, type VendorOutcome } from "./envelope";

const PAGE: EndpointPaths = { live: "/v3/on_page/instant_pages" };
const HTML: EndpointPaths = { live: "/v3/on_page/raw_html" };

/** The rendered document, from the page's own row and the HTML kept for it.
 *  Its address is the one asked for: that is the page the site links to. */
export function parseRendered(result: unknown, url: string, readAt: Date): StoredDocument[] | undefined {
  if (!isRecord(result) || !isRecord(result.page) || !isRecord(result.html)) return undefined;
  const page = asArray(result.page.items)[0];
  if (!isRecord(page)) return [];
  const status = asNumber(page.status_code);
  const html = isRecord(result.html.items) ? asString(result.html.items.html) : undefined;
  if (status !== 200 || page.resource_type !== "html" || html === undefined) return [];
  const kept = html.slice(0, OWN_DOCUMENT_MAX_BYTES);
  return [{ url, status, html: kept, bytes: Buffer.byteLength(kept, "utf8"), readAt: readAt.toISOString() }];
}

async function render(url: string): Promise<VendorOutcome> {
  const page = await callEndpoint(PAGE, "live", null, { url, enable_javascript: true, store_raw_html: true });
  if (!page.ok || page.noResults === true) return page;
  const charged = page.vendorCents === undefined ? {} : { vendorCents: page.vendorCents };
  if (page.taskId === undefined) {
    return { ok: false, failure: "unparseable", billed: true, reason: "dataforseo: the rendered page carries no task id", ...charged };
  }
  const html = await callEndpoint(HTML, "live", null, { id: page.taskId, url });
  // The page was drawn and charged for, whatever became of its HTML.
  if (!html.ok) return { ...html, billed: true, ...charged };
  return { ok: true, result: { page: page.result, html: html.result }, ...charged };
}

export async function renderedPage(
  c: CostContext,
  a: {
    /** An address on the customer's own site. */
    url: string;
    /** The caller's window: `CACHE_WINDOWS_D.own`. */
    freshnessDays: number;
  }
): Promise<Measured<StoredDocument[]>> {
  const readAt = new Date();
  return ledgered<StoredDocument>(c, {
    source: RENDERED_FETCH_SOURCE,
    cacheKey: a.url,
    freshnessDays: a.freshnessDays,
    costCents: PRICE_BOOK.RENDERED_PAGE_C,
    fetch: () => render(a.url),
    parse: (result) => parseRendered(result, a.url, readAt),
  });
}
