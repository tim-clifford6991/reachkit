// SPEC §6 *Topics by business fit* (issue 1506, from the SEO review of
// 2026-10-17, item 7) — a search whose top ten is another kind of business.
//
// reachkit.app, a software product, went live on "best answer engine
// optimization services": the top ten were agencies and lists of agencies.
// A buyer there is choosing whom to hire, and no page of a product's
// answers that. So a search whose stored top ten holds six or more results
// of the kind of business that is not this one's, read off a SERP stored no
// more than 30 days before, is `low_fit`, whatever its volume (the SEO
// master review of 2026-10-18 on the issue):
//
//   software       agencies — a firm that does the work by hand;
//   shop           directories — review sites and listings — where it sells
//                  everywhere: a shop that serves one place is found
//                  through them ("bakery near me" is Yelp and Tripadvisor
//                  for every bakery on the panel), so they are its market;
//   local service  publishers — articles and round-ups, not providers —
//                  for a page that sells: a Q&A, how-to or documentation
//                  page answers, and its top ten is articles for every
//                  kind (issue 1561).
//
// Hospitality, professional services and creators have no such kind: a
// café's market is its listings, an agency's is agencies, and a teacher's
// is articles. A market concluded before kinds (D69) is read as none.
//
// The reading of each result is the rivals' own (`market/rivals/domains`):
// a listing host is a directory and a round-up or article row is a
// publisher, the same signal that keeps a publisher out of the rivals, with
// a ranked title in any language beside it. An agency is read off the
// result's own title in every language's words.
// Pure, and stored evidence only: it buys nothing.
import { SHAPES } from "@/lib/locale/language";
import type { BusinessKind } from "@/lib/market/kinds";
import { isArticleRow, isExplainerTitle, isListingAddress, isListingHost, isMarketplaceHost, isOwnContentUrl, isRoundupPage } from "@/lib/market/rivals/domains";
import { CONTENT_MIX } from "@/lib/config/constants";
import { isLocalSearch, saysNearMe } from "@/lib/locale/place";
import type { Place } from "@/lib/locale/locales";
import { contentTypeOf } from "../content-type";
import type { Opportunity } from "../types";

export type OtherKind = "agency" | "directory" | "publisher";

/** The kind of business whose top ten is not this kind's market. Drafted
 *  (issue 1506); the owner may correct it. */
export const OTHER_KIND: Readonly<Partial<Record<BusinessKind, OtherKind>>> = Object.freeze({
  software: "agency",
  shop: "directory",
  "local-service": "publisher",
});

/** The business as this reads it: its kind, and the one place it serves
 *  (`MarketConclusion.serves`), `null` where it sells everywhere. */
export interface KindOfBusiness {
  kind?: BusinessKind | null;
  serves?: unknown;
  /** The market's category and its other names, as one string (issue
   *  1561): what a local search names the service by. */
  words?: string;
}

/** How many of a top ten's results of the other kind make it that kind's
 *  market, and how old a stored SERP may be to say so. */
export const OTHER_KIND_TOP_TEN = Object.freeze({ min: 6, maxAgeDays: 30 });

/** A stored top ten and when its SERP was bought. */
export interface TopTenRead {
  at: Date;
  rows: readonly TopTenRow[];
  /** Whether the SERP showed a local pack. Absent reads as none. */
  localPack?: boolean;
}

/** The rows of a stored top ten still young enough to say anything at
 *  `now`, or `null`. */
export function freshTopTen(read: TopTenRead | null | undefined, now: Date): readonly TopTenRow[] | null {
  return freshRead(read, now)?.rows ?? null;
}

/** A stored top ten still young enough to say anything at `now`, or `null`. */
export function freshRead(read: TopTenRead | null | undefined, now: Date): TopTenRead | null {
  if (read == null) return null;
  return now.getTime() - read.at.getTime() <= OTHER_KIND_TOP_TEN.maxAgeDays * 86_400_000 ? read : null;
}

export interface TopTenRow {
  domain: string;
  url?: string;
  title?: string;
}

function words(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** A title that ranks others in any language's words: a "best" beside a
 *  number ("Die 10 besten Elektriker", "beste Bäckerei 2026"). The rivals'
 *  own round-up reading knows English titles only. */
function rankedList(title: string | undefined): boolean {
  if (title === undefined) return false;
  const text = words(title);
  return SHAPES.best.test(text) && /\p{N}/u.test(text);
}

/** Whether one result is a business of `kind`, read off its own address and
 *  title. */
export function resultIs(row: TopTenRow, kind: OtherKind): boolean {
  if (kind === "directory") return isListingHost(row.url ?? row.domain) || isListingHost(row.domain);
  if (kind === "publisher") return !isListingHost(row.domain) && (isRoundupPage(row) || isArticleRow(row) || rankedList(row.title));
  return row.title !== undefined && SHAPES.agency.test(words(row.title));
}

/** The one place the business serves, or `null`. */
export function servedPlace(business: KindOfBusiness | null | undefined): Place | null {
  const serves = business?.serves;
  return typeof serves === "object" && serves !== null && typeof (serves as Place).name === "string" ? (serves as Place) : null;
}

/**
 * Whether a page answers a question rather than sells (issue 1561): a Q&A,
 * a how-to or documentation, whose search does not ask for the business's
 * place. Its top ten is articles for every kind of business, so a
 * publishers' top ten does not make it another kind's market. "water
 * heater repair cost" and "how to unclog a drain" are; "plumber austin"
 * and "emergency plumber near me" are not.
 */
export function answersQuestion(page: Pick<Opportunity, "type" | "targetQuery">, business: KindOfBusiness | null): boolean {
  const type = contentTypeOf(page);
  if (type === null || !(CONTENT_MIX.NON_COMMERCIAL_TYPES as readonly string[]).includes(type)) return false;
  const query = page.targetQuery ?? "";
  const place = servedPlace(business);
  return !(place === null ? saysNearMe(query) : isLocalSearch(query, place));
}

/**
 * The other kind of business a stored top ten is, for `business` — six or
 * more of its first ten results — or `null` where it is not, or the
 * business's kind is not known. A publishers' top ten says nothing of a
 * `page` that answers a question (`answersQuestion`, issue 1561).
 */
export function otherKindTopTen(
  rows: readonly TopTenRow[],
  business: KindOfBusiness | null,
  page?: Pick<Opportunity, "type" | "targetQuery">
): OtherKind | null {
  const kind = business?.kind ?? null;
  const other = kind === null ? undefined : OTHER_KIND[kind];
  if (other === undefined) return null;
  if (other === "directory" && business?.serves != null) return null;
  if (other === "publisher" && page !== undefined && answersQuestion(page, business)) return null;
  const held = rows.slice(0, 10).filter((row) => resultIs(row, other)).length;
  return held >= OTHER_KIND_TOP_TEN.min ? other : null;
}

/** How many of a top ten's results must be providers' own pages for its
 *  search to ask for one (SEO review C1, owner ruling B6, 2026-10-19). */
export const OFFERING_TOP_TEN = Object.freeze({ min: 5 });

/** Whether a result is a provider's own service or product page: not a
 *  listing, a marketplace, a round-up, an article, an explainer or a page
 *  of its own blog, in any language's words. */
export function isProviderPage(row: TopTenRow): boolean {
  const address = row.url ?? row.domain;
  if (isListingAddress(address) || isListingHost(row.domain) || isMarketplaceHost(row.domain)) return false;
  if (isRoundupPage(row) || isArticleRow(row) || rankedList(row.title)) return false;
  if (row.title !== undefined && (isExplainerTitle(row.title) || SHAPES.guide.test(words(row.title)))) return false;
  return row.url === undefined || !isOwnContentUrl(row.url);
}

/**
 * Whether a stored results page asks for the business's own offering page:
 * a local pack, for a business that serves one place, or providers' own
 * pages for `OFFERING_TOP_TEN.min` or more of its first ten results.
 */
export function offeringTopTen(read: Pick<TopTenRead, "rows" | "localPack">, business: KindOfBusiness | null): boolean {
  if (read.localPack === true && servedPlace(business) !== null) return true;
  return read.rows.slice(0, 10).filter(isProviderPage).length >= OFFERING_TOP_TEN.min;
}
