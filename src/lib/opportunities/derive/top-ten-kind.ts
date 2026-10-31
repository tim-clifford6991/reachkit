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
import {
  isArticleRow,
  isExplainerTitle,
  isJobRow,
  isListingAddress,
  isListingHost,
  isMarketplaceHost,
  isOwnContentUrl,
  isPublicHost,
  isRoundupPage,
  registrableDomain,
} from "@/lib/market/rivals/domains";
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

/** The drafted thresholds of an offering results page (SEO ruling on
 *  issue 1618, 2026-10-20); the owner may correct them. */
export const OFFERING_TOP_TEN = Object.freeze({
  /** Fewer organic results than this say nothing. */
  minRows: 6,
  /** More job pages than this make it a job seeker's search. */
  maxJobs: 2,
  /** Providers' own pages, and more of them than articles. */
  minProviders: 4,
  /** Beside a local pack, at most this many articles. */
  maxArticlesBesidePack: 3,
});

/** What one top-ten result is: a job page, a public body or a school, a
 *  third party that lists others, an article, or a provider's own page. */
export type ResultClass = "job" | "public" | "third_party" | "article" | "provider";

const SEARCH_PARAM = /^(find_desc|find_loc|q|query|search|s|k|keyword|what|where)$/;
const DIRECTORY_SEGMENT =
  /^(search|suche|find|directory|verzeichnis|branchen|firmen|companies|categories|listings?|profiles?|biz|doctor-locator|filialen|threads?|forums?|community|groups|questions)$/;
const DIRECTORY_NAME = /agencies|companies|firms|directory|listings|branchenbuch|telefonbuch|^(best|top)\p{L}+s$/u;
const ARTICLE_SEGMENT = /^(stories|story|features|maps|magazin(e)?|journal|news|presse|ratgeber|wissen|lexikon)$/;
const QUESTION_TITLE = /\?\s*$|^(what|why|how|where|who|which|wie|was|warum|wo|welche)(?![\p{L}\p{N}])/iu;
const NUMBERED_TITLE = /^\d+\s+(?!(hours?|stunden?)(?![\p{L}\p{N}]))\p{L}/iu;
const BYLINE = /(?<![\p{L}\p{N}])(by|von)\s+\p{Lu}/u;
const ARTICLE_HOST = /\.(blog|news|media|magazine)$|^(blog|news|magazin(e)?|journal)\./;

function segmentsOf(url: string | undefined): { path: string[]; params: string[] } {
  if (url === undefined) return { path: [], params: [] };
  try {
    const parsed = new URL(url);
    return { path: parsed.pathname.toLowerCase().split("/").filter(Boolean), params: [...parsed.searchParams.keys()].map((key) => key.toLowerCase()) };
  } catch {
    return { path: [], params: [] };
  }
}

/** The words of an address's last segment: its file ending and any part
 *  holding a digit (an id, a page number) are not words. */
function slugWords(segment: string): number {
  return segment.replace(/\.[a-z0-9]+$/, "").split("-").filter((part) => /^\p{L}+$/u.test(part)).length;
}

/**
 * One top-ten result's class, from its stored address and title alone: the
 * first that matches wins, so a directory's "THE BEST 10 PLUMBING" is a
 * third party, not an article. A provider's own page is what is left.
 */
export function resultClass(row: TopTenRow): ResultClass {
  const host = row.domain.toLowerCase().replace(/^www\./, "");
  const { path, params } = segmentsOf(row.url);
  const title = row.title ?? "";
  if (isJobRow(row)) return "job";
  if (isPublicHost(host)) return "public";
  const name = (registrableDomain(host) ?? host).split(".")[0] ?? "";
  if (
    isListingAddress(row.url ?? row.domain) ||
    isListingHost(row.domain) ||
    isMarketplaceHost(row.domain) ||
    params.some((key) => SEARCH_PARAM.test(key)) ||
    path.some((segment) => DIRECTORY_SEGMENT.test(segment)) ||
    DIRECTORY_NAME.test(name)
  )
    return "third_party";
  const last = path.at(-1) ?? "";
  if (
    isRoundupPage(row) ||
    isArticleRow(row) ||
    rankedList(row.title) ||
    (title !== "" && (isExplainerTitle(title) || SHAPES.guide.test(words(title)))) ||
    (row.url !== undefined && isOwnContentUrl(row.url)) ||
    path.some((segment) => ARTICLE_SEGMENT.test(segment)) ||
    /\/20\d\d\//.test(row.url ?? "") ||
    slugWords(last) >= 6 ||
    QUESTION_TITLE.test(title.trim()) ||
    NUMBERED_TITLE.test(title.trim()) ||
    BYLINE.test(title) ||
    ARTICLE_HOST.test(host)
  )
    return "article";
  return "provider";
}

/**
 * Whether a stored results page asks for the business's own offering page:
 * at least `minRows` results, not a job seeker's search, not a search to
 * learn something, and either providers' own pages outnumber articles, or
 * a local pack, for a business that serves one place, on a search that is
 * not a list, beside few articles. Directories, social and public pages
 * count for neither side.
 */
export function offeringTopTen(read: Pick<TopTenRead, "rows" | "localPack">, business: KindOfBusiness | null, query: string): boolean {
  const rows = read.rows.slice(0, 10);
  if (rows.length < OFFERING_TOP_TEN.minRows) return false;
  const classes = rows.map(resultClass);
  const count = (kind: ResultClass) => classes.filter((each) => each === kind).length;
  if (count("job") > OFFERING_TOP_TEN.maxJobs) return false;
  const text = words(query);
  if ([SHAPES.howTo, SHAPES.guide, SHAPES.informational, SHAPES.insights].some((shape) => shape.test(text))) return false;
  const providers = count("provider");
  const articles = count("article");
  if (providers >= OFFERING_TOP_TEN.minProviders && providers > articles) return true;
  return read.localPack === true && servedPlace(business) !== null && !SHAPES.listicle.test(text) && articles <= OFFERING_TOP_TEN.maxArticlesBesidePack;
}
