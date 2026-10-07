// SPEC §7 Rules ("Every asset links to real inventory pages … and to
// earlier assets in its cluster", 2026-09-12) · §0 "Site profile".
//
// Which of the customer's own pages a new page links to. Decided here, in
// code, before a model is asked for a word — the model is told the list
// and `apply.ts` holds the finished page to it.
//
// **Drawn from what was read, never from a convention.** A site-page
// target is a row of the site profile's inventory, and an inventory row
// exists only for a page the crawl fetched and parsed. `/pricing` is never
// assumed: a site whose crawl found no pricing page gets no pricing link,
// and nothing in its place.
//
// **Earlier pages are the cluster's live ones.** A cluster target is a
// publication with a live address, published and not since unpublished,
// that the day-after check did not find gone. A page the product took
// down, or one its own verification answered 404 for, is a link known to
// lead nowhere.
//
// **The words are the customer's.** A target's label is the page's own
// `<h1>`, or its `<title>` where it has none — never a sentence of the
// product's. A page with neither has no words to link with and is left
// out rather than labelled by us.
import { CROSS_LINKS } from "@/lib/config/constants";
import type { InventoryRow, PagePurpose } from "@/lib/site-profile/types";
import { knownLinkTargets as chooseKnownLinks } from "@/lib/known-content/links";
import type { KnownPage } from "@/lib/known-content/types";

/** The inventory purposes §7 names, in the order a page's links are listed.
 *  `blog`, `contact`, `legal` and `other` are not among them. */
export const LINKED_PURPOSES = ["pricing", "about", "features", "product"] as const satisfies readonly PagePurpose[];

export type LinkedPurpose = (typeof LINKED_PURPOSES)[number];

export type LinkTarget =
  | { source: "site"; purpose: LinkedPurpose; url: string; label: string }
  | { source: "cluster"; url: string; label: string }
  /** SPEC §7 (2026-09-20, #928): a page the site already has, whoever wrote
   *  it — one of ours, a post on their connected WordPress, or a page the
   *  crawl read. "New pages link to known content where it helps the
   *  reader", and the page a skipped topic was a repeat of is linked from
   *  the pages related to it. */
  | { source: "known"; url: string; label: string };

/** One earlier page of the cluster, as the store reads it. */
export interface ClusterPage {
  liveUrl: string;
  title: string;
  publishedAt: Date;
}

/** The site's own pages a page for `query` links to: one pricing, one
 *  about and one features page, and up to `PRODUCT_PAGES_MAX` product
 *  pages — each only where the inventory holds one. */
export function siteLinkTargets(a: {
  domain: string;
  inventory: readonly InventoryRow[];
  query: string;
  /** The page being written, where it already has an address (an Improve
   *  target's own URL) — a page does not link to itself. */
  selfUrl?: string | null;
}): LinkTarget[] {
  const self = a.selfUrl ? urlKey(a.selfUrl) : null;
  const rows = a.inventory.filter(
    (row) => onSite(row.url, a.domain) && labelOf(row) !== "" && (self === null || urlKey(row.url) !== self)
  );
  const wanted = wordsOf(a.query);
  const targets: LinkTarget[] = [];

  for (const purpose of LINKED_PURPOSES) {
    const candidates = dedupe(rows.filter((row) => row.purpose === purpose));
    if (purpose === "product") {
      const ranked = candidates
        .map((row) => ({ row, shared: sharedWords(wanted, row) }))
        .sort((x, y) => y.shared - x.shared || depth(x.row.url) - depth(y.row.url));
      for (const { row } of ranked.slice(0, CROSS_LINKS.PRODUCT_PAGES_MAX)) {
        targets.push({ source: "site", purpose, url: row.url, label: labelOf(row) });
      }
    } else {
      // The section's own page: `/pricing` over `/pricing/enterprise`.
      const first = [...candidates].sort((x, y) => depth(x.url) - depth(y.url))[0];
      if (first !== undefined) targets.push({ source: "site", purpose, url: first.url, label: labelOf(first) });
    }
  }
  return targets;
}

/**
 * The pages the site already has that a page about `query` may link to
 * (#928).
 *
 * The vetting — live, on this site, not itself — and the ranking are
 * `known-content/links.ts`'s, which is the one place that decides what a
 * link candidate is. This is where the day's page asks for them, beside the
 * inventory's pages and the cluster's, and it drops the ones those two
 * already chose: a page linked twice is one link, and the list the model is
 * told must be the list the finished page is held to.
 */
export function knownLinkTargets(
  pages: readonly KnownPage[],
  a: { domain: string; query: string; selfUrl?: string | null; already?: readonly LinkTarget[] }
): LinkTarget[] {
  const taken = new Set(
    (a.already ?? []).map((target) => urlKey(target.url)).filter((key): key is string => key !== null)
  );
  return chooseKnownLinks(pages, {
    domain: a.domain,
    about: a.query,
    ...(a.selfUrl === undefined ? {} : { selfUrl: a.selfUrl }),
  })
    .filter((link) => {
      const key = urlKey(link.url);
      return key !== null && !taken.has(key);
    })
    .map((link) => ({ source: "known" as const, url: link.url, label: link.label }));
}

/** The cluster's earlier live pages, newest first, bounded. */
export function clusterLinkTargets(pages: readonly ClusterPage[]): LinkTarget[] {
  const seen = new Set<string>();
  return [...pages]
    .filter((page) => page.title.trim() !== "")
    .sort((x, y) => y.publishedAt.getTime() - x.publishedAt.getTime())
    .filter((page) => {
      const key = urlKey(page.liveUrl);
      if (key === null || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, CROSS_LINKS.CLUSTER_PAGES_MAX)
    .map((page) => ({ source: "cluster" as const, url: page.liveUrl, label: page.title.trim() }));
}

/** The comparable identity of an address: host without `www.`, lower-cased,
 *  path without a trailing slash, the query kept (the inventory holds
 *  `/product?id=1` and `?id=2` as two pages), no fragment. `null` for an
 *  address that does not parse. */
export function urlKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${host}${path}${parsed.search}`;
}

/** True where `url` is on the customer's domain or one of its subdomains —
 *  the hosted destination serves from one. */
export function onSite(url: string, domain: string): boolean {
  const key = urlKey(url);
  if (key === null) return false;
  const host = key.split(/[/?]/)[0] ?? "";
  const site = domain.toLowerCase().replace(/^www\./, "");
  return host === site || host.endsWith(`.${site}`);
}

function labelOf(row: InventoryRow): string {
  return (row.h1.trim() || row.title.trim()).replace(/\s+/g, " ");
}

function dedupe(rows: readonly InventoryRow[]): InventoryRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = urlKey(row.url);
    if (key === null || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function depth(url: string): number {
  const key = urlKey(url);
  return key === null ? Number.MAX_SAFE_INTEGER : (key.split("?")[0] ?? "").split("/").length;
}

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2)
  );
}

function sharedWords(wanted: Set<string>, row: InventoryRow): number {
  let shared = 0;
  for (const word of wordsOf(`${row.title} ${row.h1} ${row.url}`)) if (wanted.has(word)) shared++;
  return shared;
}
