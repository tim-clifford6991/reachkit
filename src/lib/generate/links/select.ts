// SPEC §7 Rules ("Every asset links to real inventory pages … and to
// earlier assets in its cluster", 2026-09-12; *Deep links*, 2026-10-10,
// issue 1391) · §0 "Site profile".
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
// **Ranked by what the page is about, across the whole inventory.** Every
// crawled page is a candidate — a menu, a case study, a post — and the ones
// offered are those whose title, heading and address share the most with
// the page's topic. A word every page of the site carries (its name) tells
// no two pages apart and counts for nothing; a word one page carries counts
// most. One place is kept for the page where a reader acts on what they
// read — the pricing page, else the product or features page nearest the
// topic — because a page with no way to the product is a dead end. No more
// than two come from one section of the site.
//
// **Earlier pages are the cluster's live ones.** A cluster target is a
// publication with a live address, published and not since unpublished,
// that the day-after check did not find gone. A page the product took
// down, or one its own verification answered 404 for, is a link known to
// lead nowhere.
//
// **The words name the page.** A target's label is `text.ts`'s `pageName`:
// the page's own heading where it says what the address says, else the
// address's words — never its slogan, and never a sentence of the
// product's. A page with no words to link with is left out.
import { CROSS_LINKS } from "@/lib/config/constants";
import type { InventoryRow, PagePurpose } from "@/lib/site-profile/types";
import { knownLinkTargets as chooseKnownLinks } from "@/lib/known-content/links";
import type { KnownPage } from "@/lib/known-content/types";
import { linkWords, pageName, sameWord } from "./text";

/** The purposes of a page where a reader acts on what they read, in the
 *  order one is taken where two share as much with the topic. */
export const BUYING_PURPOSES = ["pricing", "product", "features"] as const satisfies readonly PagePurpose[];

/** Why a page was chosen, as the draft screen says it (issue 1391). */
export type LinkWhy =
  /** Its title, heading or address shares these words with the page's topic. */
  | { kind: "topic"; words: string[] }
  /** It is where a reader acts on the page: the product, features or pricing page. */
  | { kind: "buy" }
  /** One of the site's main pages, linked where none is near the topic. */
  | { kind: "main" }
  /** An earlier page of the same cluster. */
  | { kind: "cluster" }
  /** A page the site already has on a near topic. */
  | { kind: "known" }
  /** A newer page of the site this older one is updated to link. */
  | { kind: "newer" };

export type LinkTarget =
  | {
      source: "site";
      purpose: PagePurpose;
      url: string;
      label: string;
      why?: LinkWhy;
      /** The page's own `<h1>` and `<title>`, which a link's text may not
       *  be a rewording of where they are a slogan (`apply.ts`). */
      said?: readonly string[];
    }
  | { source: "cluster"; url: string; label: string; why?: LinkWhy }
  /** SPEC §7 (2026-09-20, #928): a page the site already has, whoever wrote
   *  it — one of ours, a post on their connected WordPress, or a page the
   *  crawl read. "New pages link to known content where it helps the
   *  reader", and the page a skipped topic was a repeat of is linked from
   *  the pages related to it. */
  | { source: "known"; url: string; label: string; why?: LinkWhy };

/** One earlier page of the cluster, as the store reads it. */
export interface ClusterPage {
  liveUrl: string;
  title: string;
  publishedAt: Date;
}

/** A page that is a door and not a destination — sign-in, search, the
 *  basket — read off its address. An article links none of them. */
const UTILITY_RE = /(?:^|\/)(?:log-?in|sign-?in|sign-?up|register|search|cart|basket|checkout|account)(?:\.[a-z]+)?\/?$/i;

interface Ranked {
  row: InventoryRow;
  score: number;
  shared: string[];
}

/** The site's own pages a page for `query` links to: up to
 *  `CROSS_LINKS.SITE_MAX`, the page a reader acts on first and then the
 *  pages nearest the topic. The home page and the legal pages are never
 *  among them: one is where every page already leads, the others answer no
 *  sentence of an article; nor is a sign-in, search or basket page. */
export function siteLinkTargets(a: {
  domain: string;
  inventory: readonly InventoryRow[];
  query: string;
  /** The page being written, where it already has an address (an Improve
   *  target's own URL) — a page does not link to itself. */
  selfUrl?: string | null;
}): LinkTarget[] {
  const self = a.selfUrl ? urlKey(a.selfUrl) : null;
  const rows = dedupe(
    a.inventory.filter(
      (row) =>
        onSite(row.url, a.domain) &&
        row.purpose !== "legal" &&
        depth(row.url) > 1 &&
        !UTILITY_RE.test(pathOf(row.url)) &&
        pageName(row) !== "" &&
        (self === null || urlKey(row.url) !== self)
    )
  );
  if (rows.length === 0) return [];

  // How many of the site's pages carry each word: the fewer, the more it
  // says about the one that does.
  const wordsByRow = new Map(rows.map((row) => [row, [...new Set(linkWords(`${row.title} ${row.h1} ${pathOf(row.url)}`))]]));
  const carriers = (word: string): number =>
    rows.filter((row) => (wordsByRow.get(row) ?? []).some((held) => sameWord(held, word))).length;
  const wanted = [...new Set(linkWords(a.query))].map((word) => ({ word, weight: Math.log(rows.length / Math.max(1, carriers(word))) }));

  const ranked: Ranked[] = rows
    .map((row) => {
      const held = wordsByRow.get(row) ?? [];
      const shared = wanted.filter((want) => held.some((word) => sameWord(word, want.word)));
      return {
        row,
        // A word every page carries has no weight; it still breaks a tie.
        score: shared.reduce((sum, want) => sum + want.weight, 0) + shared.length * 1e-6,
        shared: shared.filter((want) => want.weight > 0).map((want) => want.word),
      };
    })
    .sort((x, y) => y.score - x.score || depth(x.row.url) - depth(y.row.url));

  // The page a reader acts on: the pricing page where the site has one,
  // else the product or features page nearest the topic.
  const buying = (purpose: PagePurpose): number => (BUYING_PURPOSES as readonly PagePurpose[]).indexOf(purpose);
  const action = [...ranked]
    .filter((each) => buying(each.row.purpose) >= 0)
    .sort(
      (x, y) => buying(x.row.purpose) - buying(y.row.purpose) || y.score - x.score || depth(x.row.url) - depth(y.row.url)
    )[0];

  // Nearest first, and no more than two from one section of the site: six
  // sibling pages under `/solutions/` are one answer said six times.
  const chosen: Ranked[] = action === undefined ? [] : [action];
  const perSection = new Map<string, number>();
  const take = (each: Ranked): void => {
    const section = sectionOf(each.row.url);
    if (chosen.length >= CROSS_LINKS.SITE_MAX || chosen.includes(each)) return;
    if (section !== null && (perSection.get(section) ?? 0) >= 2) return;
    if (section !== null) perSection.set(section, (perSection.get(section) ?? 0) + 1);
    chosen.push(each);
  };
  if (action !== undefined) {
    const section = sectionOf(action.row.url);
    if (section !== null) perSection.set(section, 1);
  }
  for (const each of ranked) if (each.score > 1e-3) take(each);
  // Short of the floor, the site's own main pages fill it — product,
  // features, pricing, about, the section's own page first (`/pricing` over
  // `/pricing/enterprise`) — and then whatever else the crawl read.
  if (chosen.length < CROSS_LINKS.SITE_MIN) {
    const main: readonly PagePurpose[] = [...BUYING_PURPOSES, "about"];
    const order = (purpose: PagePurpose): number => (main.includes(purpose) ? main.indexOf(purpose) : main.length);
    const rest = ranked
      .filter((each) => !chosen.includes(each))
      .sort((x, y) => order(x.row.purpose) - order(y.row.purpose) || depth(x.row.url) - depth(y.row.url));
    const seen = new Set(chosen.map((each) => each.row.purpose).filter((purpose) => main.includes(purpose)));
    for (const each of rest) {
      if (chosen.length >= CROSS_LINKS.SITE_MIN) break;
      if (seen.has(each.row.purpose)) continue;
      if (main.includes(each.row.purpose)) seen.add(each.row.purpose);
      take(each);
    }
  }

  return chosen.map((each) => ({
    source: "site" as const,
    purpose: each.row.purpose,
    url: each.row.url,
    label: pageName(each.row),
    why:
      each.score > 1e-3 && each.shared.length > 0
        ? { kind: "topic" as const, words: each.shared }
        : { kind: each === action ? ("buy" as const) : ("main" as const) },
    said: [each.row.h1, each.row.title].filter((text) => text.trim() !== ""),
  }));
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
    .map((link) => ({ source: "known" as const, url: link.url, label: link.label, why: { kind: "known" as const } }));
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
    .map((page) => ({ source: "cluster" as const, url: page.liveUrl, label: page.title.trim(), why: { kind: "cluster" as const } }));
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

/** The section a nested page sits in — `/solutions/sales` is in
 *  `solutions` — or `null` for a page at the top of the site. */
function sectionOf(url: string): string | null {
  const segments = pathOf(url).split("/").filter((segment) => segment !== "");
  return segments.length >= 2 ? (segments[0] ?? null) : null;
}

function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return "";
  }
}
