// src/lib/market/rivals/domains.ts — BP-026
//
// WO-077. The product's one answer to "what domain is this", "is it a
// platform" and "is it the customer's own", so a customer's own hosted page
// can never become their own rival (BP-026 `## Error & edge behavior`).
// Three pure, total functions — no network, no DNS, no clock, no throw.
//
// Rule 7.2 reuse: `registrableDomain` calls `parseDomain` (WO-051,
// `src/lib/scan/domain.ts`) for every step that function already owns —
// lower-casing, scheme/userinfo/port/path/query stripping, trailing-dot
// stripping, IP-literal rejection, IDN-to-punycode, and the listed-public-
// suffix check. `parseDomain`'s `CanonicalDomain` deliberately keeps
// subdomains other than `www.` (WO-051's own contract: `content.` stays
// `content.` there), so it is not by itself this file's eTLD+1. The one
// step this file adds is the eTLD+1 reduction `parseDomain` does not do:
// a second `psl.parse` call on the already-validated, already-normalised
// host, reading its `domain` field (`psl`'s eTLD+1, e.g.
// `content.example.co.uk` -> `example.co.uk`, never `co.uk` — verified
// against `psl`'s own behaviour, not hand-rolled). This is not a second
// implementation of `parseDomain` (rule 7.1): `psl` is already `domain.ts`'s
// own dependency and this file calls it for exactly the one field
// `domain.ts` does not expose.
import { parse as pslParse } from "psl";
import { parseDomain } from "@/lib/scan/domain";
import { PLATFORM_DOMAINS } from "@/lib/config/constants";

/** eTLD+1, lower-cased. Accepts a bare host or a full URL (scheme, userinfo,
 *  port, path, query and a trailing dot are all stripped by `parseDomain`).
 *  `example.co.uk` reduces to `example.co.uk`, never `co.uk` — the
 *  public-suffix table decides where the registrable boundary falls, not a
 *  fixed label count. Anything that is not a parseable hostname, and any IP
 *  literal, returns `null`. */
export function registrableDomain(hostOrUrl: string): string | null {
  const parsed = parseDomain(hostOrUrl);
  if (!parsed.ok) return null;

  const reduced = pslParse(parsed.domain);
  if ("error" in reduced || !reduced.domain) return null;
  return reduced.domain;
}

/**
 * Sites that only list, review or report on other businesses — app stores,
 * review sites, directories, social networks, news and publishers — and are
 * never a business's rival (SPEC §0 Rival, D24; issue 1417). A closed list
 * of the ones a top ten or an AI answer most often holds in the product's
 * countries. An entry with a subdomain (`apps.apple.com`) is that host and
 * the ones under it, never the rest of its registrable domain: Apple's own
 * products stay at `apple.com`. The customer panel judges its rivals
 * against this same list.
 */
export const LISTING_HOSTS: ReadonlySet<string> = new Set(
  (
    "yelp.com yelp.co.uk tripadvisor.com tripadvisor.co.uk tripadvisor.de google.com facebook.com instagram.com linkedin.com " +
    "youtube.com tiktok.com x.com twitter.com pinterest.com reddit.com quora.com wikipedia.org idealo.de check24.de " +
    "g2.com capterra.com getapp.com softwareadvice.com trustpilot.com trustradius.com producthunt.com clutch.co sortlist.com " +
    "goodfirms.co designrush.com angi.com angieslist.com homeadvisor.com thumbtack.com houzz.com " +
    "bbb.org yellowpages.com nextdoor.com checkatrade.com trustatrader.com mybuilder.com ratedpeople.com bark.com yell.com " +
    "freeindex.co.uk which.co.uk gelbeseiten.de dasoertliche.de 11880.com golocal.de kennstdueinen.de jameda.de " +
    "myhammer.de healthgrades.com webmd.com eater.com timeout.com theinfatuation.com michelin.com " +
    "apps.apple.com play.google.com forbes.com nytimes.com theguardian.com techcrunch.com nerdwallet.com " +
    "legal500.com chambers.com lawsociety.org.uk icaew.com unbiased.co.uk " +
    "apps.microsoft.com apps.shopify.com marketplace.atlassian.com alternativeto.net saasworthy.com f-droid.org " +
    // Issue 1465: reference, review, news and job sites, catalogues of
    // films, and hosts of personal blogs, as the stored scans held them.
    "imdb.com rottentomatoes.com letterboxd.com netflix.com tv.apple.com merriam-webster.com collinsdictionary.com " +
    "dictionary.cambridge.org dictionary.com stackexchange.com study.com investopedia.com pcmag.com cnet.com " +
    "indeed.com ziprecruiter.com glassdoor.com huffpost.com mapquest.com livejournal.com github.io " +
    // Directories and listings the panel's stored local searches held.
    "cylex.de cylex-uk.co.uk werkenntdenbesten.de hamuch.com practo.com carecredit.com wlw.de dastelefonbuch.de kaufda.de feinschmecker.de"
  ).split(" ")
);

/**
 * Marketplaces: they list other businesses, and they are also a real rival
 * of some customers — Udemy of a course creator, Substack of a newsletter
 * tool, Booking.com of a hotel (master review of #1421). Only a page of
 * another business on one is a listing (`isListingAddress`); the
 * marketplace itself may be a rival.
 */
export const MARKETPLACE_HOSTS: ReadonlySet<string> = new Set(
  (
    "medium.com substack.com amazon.com amazon.co.uk amazon.de ebay.com ebay.co.uk ebay.de etsy.com walmart.com " +
    "otto.de zalando.de upwork.com fiverr.com doctolib.de zocdoc.com treatwell.co.uk treatwell.de fresha.com booksy.com " +
    "opentable.com opentable.co.uk thefork.com resy.com doordash.com ubereats.com grubhub.com deliveroo.co.uk lieferando.de " +
    "booking.com expedia.com airbnb.com airbnb.co.uk udemy.com coursera.org skillshare.com"
  ).split(" ")
);

/** The first path segment of a marketplace page that is one business's or
 *  one product's own: a product, an app, a shop, a course, a venue. */
const LISTING_SECTION =
  /^(marketplace|products?|apps?|biz|course|courses|learn|specializations|dp|itm|str|listing|ip|shop|store|stores|seller|restaurant|restaurants|r|a|menu|speisekarte|hotel|hotels|rooms|place|places|venue|venues|salon|doctor|practice|profile|freelancers)$/;

/** Marketplaces where each publication has its own subdomain. */
const PUBLICATION_HOSTS: ReadonlySet<string> = new Set(["substack.com", "medium.com"]);

function under(host: string, hosts: ReadonlySet<string>): string | null {
  for (const entry of hosts) if (host === entry || host.endsWith(`.${entry}`)) return entry;
  return null;
}

/** Whether `host` is one of `LISTING_HOSTS`, or under one. Read on the host
 *  as written, so `apps.apple.com` is a store and `apple.com` is not. A
 *  marketplace is not a listing host. */
export function isListingHost(hostOrUrl: string): boolean {
  const parsed = parseDomain(hostOrUrl);
  return parsed.ok && under(parsed.domain, LISTING_HOSTS) !== null;
}

/**
 * Whether an address is another business's listing (issue 1417): on a
 * listing host anywhere, and on a marketplace a page of one business or
 * product — `/course/<x>`, `/dp/<x>`, `/biz/<x>`, `/@<x>`, or a
 * publication's own subdomain (`<x>.substack.com`). A marketplace's own
 * home or product pages are not, so the marketplace stays a candidate rival.
 */
export function isListingAddress(hostOrUrl: string): boolean {
  if (isListingHost(hostOrUrl)) return true;
  const parsed = parseDomain(hostOrUrl);
  if (!parsed.ok) return false;
  const marketplace = under(parsed.domain, MARKETPLACE_HOSTS);
  if (marketplace === null) return false;
  const sub = parsed.domain === marketplace ? "" : parsed.domain.slice(0, -marketplace.length - 1);
  if (PUBLICATION_HOSTS.has(marketplace) && sub !== "" && sub !== "www") return true;
  let path: string;
  try {
    path = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(hostOrUrl) ? hostOrUrl : `https://${hostOrUrl}`).pathname;
  } catch {
    return false;
  }
  const [first, second] = path.split("/").filter(Boolean).map((segment) => segment.toLowerCase());
  if (first === undefined) return false;
  if (first.startsWith("@")) return first.length > 1;
  // Amazon names a product page `/<its name>/dp/<id>` and a page of search
  // results `/s` or `/<a word>/s` (issue 1465).
  if (first === "s" || second === "s") return true;
  return second !== undefined && (LISTING_SECTION.test(first) || second === "dp");
}

/** Membership in BP-005's closed `PLATFORM_DOMAINS` list, or a listing
 *  (`isListingHost`) — a domain absent from both is a product domain by
 *  default (BP-026 `## Error & edge behavior`: "the open-world side is the
 *  rival side"). Pass the host as written where it is held: a store's
 *  subdomain is a listing, its registrable domain may not be.
 *
 *  `PLATFORM_DOMAINS` (`src/lib/config/constants.ts`, BP-005/BUILD.md §6.1)
 *  is a closed list of bare names — `"reddit"`, not `"reddit.com"` — with no
 *  TLD recorded, so membership cannot be a full eTLD+1 comparison. Matching
 *  is against the registrable domain's second-level label (`psl`'s `sld`:
 *  the single label immediately before the public suffix — `"example"` in
 *  `example.co.uk`, always dot-free, so `registrableDomain(...).split(".")[0]`
 *  reads it without a second `psl` call). This is a parameter this file
 *  chooses under constitution rule 1.1, not a customer promise: the
 *  membership *set* is BP-005's pin, transcribed and cited above, never
 *  restated here; only the *matching granularity* — sld-only rather than
 *  full eTLD+1 — is this file's own choice, forced by the set being
 *  recorded without TLDs. Reversal cost: low — it changes only which
 *  domains under an unlisted TLD false-positive-match a platform name
 *  (e.g. a hypothetical `reddit.io` would match `"reddit"`); no test in
 *  this WO's plan depends on the distinction, and no customer promise
 *  reads this file's granularity rather than the set itself. */
export function isPlatformDomain(host: string): boolean {
  const domain = registrableDomain(host);
  if (!domain) return false;
  if (isListingHost(host)) return true;

  const sld = domain.split(".")[0] ?? domain;
  return (PLATFORM_DOMAINS as readonly string[]).includes(sld);
}

/** A path that is an article about others: a blog post, a guide, a review,
 *  a "best" or "top ten" list, a comparison or a list of alternatives. */
const ARTICLE_SECTION = /^(blogs?|articles?|news|guides?|resources?|resource-hub|learn|insights|magazine|posts?|reviews?|best|top|recipes?|directory|compare)$/;
const ARTICLE_WORD = /(^|[-_])(best|top-?\d+|alternatives?|vs|versus|reviews?|compared|comparison|guides?|recipes?)($|[-_.])/;
/** A title that is a list of others: a numbered one ("10 Best Cafés in
 *  Leeds", "Top 5 plumbers"), a dated one ("Best Email Clients of 2026"),
 *  or a directory's "Reviews & Comparison". A business's own "Best Plumber
 *  in Austin" is not one. */
const LIST_TITLE =
  /(^|\s)(top\s*\d+|\d+\s+(best|top|great|favourite|favorite))\b|\b(best|top)\b.*\b20\d\d\b|\breviews?\s*(&|and)\s*comparisons?\b|^\s*\d+\s+(?:[\w-]+\s+){0,5}(tools|apps|software|platforms|services|solutions|options|companies|providers|builders|alternatives)\b/i;
/** An address segment that ranks or weighs others: "best-crm-app",
 *  "top-10-…", "…-alternatives", "x-vs-y", "…-reviews" (issue 1476). */
const ROUNDUP_WORD = /(^|[-_])(best|top-?\d+|alternatives?|vs|versus|compared|comparison|reviews?)($|[-_.])/;

/** Whether an address is an article page (issue 1417): a domain cited for
 *  one is cited as a publisher of a list, not recommended as a product. A
 *  directory's page of one category of software (`/software/email-clients/`)
 *  is one too (issue 1468). Anything that does not parse as an address is
 *  not one. */
export function isArticleUrl(url: string): boolean {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  const segments = path.split("/").filter(Boolean);
  return (
    segments.some((segment) => ARTICLE_SECTION.test(segment) || ARTICLE_WORD.test(segment)) ||
    segments.slice(0, -1).some((segment) => segment === "software")
  );
}

/** Whether a page ranks or weighs other businesses (issue 1476): its title
 *  is a list of others, or its address's last segment a "best", "top ten",
 *  "alternatives", "vs" or "reviews" page. A guide or an explainer is not
 *  one: a business explains its own market (issue 1468). A row whose read
 *  carried neither is not known to be one. */
export function isRoundupPage(page: { url?: string; title?: string }): boolean {
  if (page.title !== undefined && LIST_TITLE.test(page.title)) return true;
  if (page.url === undefined) return false;
  let segments: string[];
  try {
    segments = new URL(page.url).pathname.toLowerCase().split("/").filter(Boolean);
  } catch {
    return false;
  }
  const last = segments.at(-1);
  return last !== undefined && ROUNDUP_WORD.test(last);
}

/** One address as two reads of it compare: no scheme, no `www.`, no query,
 *  no trailing slash, lower case. `null` where it does not parse. */
export function pageKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

/** A title that explains a subject rather than offers something: "What is
 *  a PEO?", "11 types of web pages", "How to write a newsletter", "CRM
 *  explained", "Newsletter examples", "Best practices" (issue 1468). */
const EXPLAINER_TITLE =
  /^(what|why|how)\b|\b(what (is|are)|how to|definition|defining|meaning|explained|types of|examples?|best practices|ultimate guide|guide to|beginner'?s guide)\b|\b\w+ types\b|^(was ist|qu'est-ce|qué es|que es)\b/i;

/** Whether a top-ten title explains a subject (issue 1468): a search whose
 *  top ten is mostly these asks what something is, not whom to buy from. */
export function isExplainerTitle(title: string): boolean {
  return EXPLAINER_TITLE.test(title);
}

/** A title of a page for one place: "Office Space in Merced, CA", a street
 *  address ("1750 E Golf Rd"), "near Riverton". */
const PLACE_TITLE = new RegExp(
  [
    ",\\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\\b",
    "\\b\\d{1,5}\\s+(?:[NSEW]\\.?\\s+)?(?:[A-Z][a-z]+\\s+){1,3}(?:St|Street|Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Pkwy|Hwy|Highway)\\b",
    "\\bnear\\s+(?![Mm]e\\b)[A-Z][a-z]+",
  ].join("|")
);

/** Whether a top-ten title names one place (issue 1468): a national
 *  market's search whose top ten is mostly these is a search for another
 *  town's businesses, not this business's rivals. */
export function isPlaceTitle(title: string): boolean {
  return PLACE_TITLE.test(title);
}

/** Whether an address is a site's home page: no path, or only a language
 *  segment (`/en/`, `/en-us/`). */
export function isHomeUrl(url: string): boolean {
  let segments: string[];
  try {
    segments = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
  } catch {
    return false;
  }
  return segments.length === 0 || (segments.length === 1 && LOCALE_SEGMENT.test(segments[0]!));
}

/** The sections where a business keeps what it writes about its own
 *  market: its blog, its resources, its guides. A locale's segment
 *  (`/en/`, `/en-us/`) before it is read past. */
const OWN_CONTENT_SECTION = /^(blogs?|articles?|posts?|resources?|resource-hub|learn|learning-center|insights|guides?|academy|library|glossary)$/;
const LOCALE_SEGMENT = /^[a-z]{2}(?:[-_][a-z]{2})?$/;

/** Whether an article sits in its own domain's blog, resources or guides
 *  (issue 1465): a business writing about its market, as a software maker
 *  writes "The 10 best email tools" in its own blog, rather than a review
 *  site whose roundups are the whole site. */
export function isOwnContentUrl(url: string): boolean {
  let segments: string[];
  try {
    segments = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
  } catch {
    return false;
  }
  const [first, second] = segments;
  if (first === undefined) return false;
  return OWN_CONTENT_SECTION.test(first) || (LOCALE_SEGMENT.test(first) && second !== undefined && OWN_CONTENT_SECTION.test(second));
}

/** Whether a top-ten row is an article about others (issue 1449): its
 *  address is an article page, or its title a numbered list. A row whose
 *  read carried neither is not known to be one. */
export function isArticleRow(row: { url?: string; title?: string }): boolean {
  return (row.url !== undefined && isArticleUrl(row.url)) || (row.title !== undefined && LIST_TITLE.test(row.title));
}

/** A government's, an army's or a public service's host (`.gov`, `.gov.au`,
 *  `.gouv.fr`, `.gob.mx`, `nhs.uk`), or a university's or a school's
 *  (`.edu`, `.ac.uk`, `.edu.au`): it informs or teaches, and is no
 *  business's rival (issue 1449). Suffixes only, so a national agency on a
 *  plain `.de` is not one. */
const PUBLIC_HOST = /(^|\.)(gov|mil)(\.[a-z]{2})?$|(^|\.)(govt|gouv|gob)\.[a-z]{2}$|(^|\.)(gc\.ca|nhs\.uk|police\.uk|bund\.de|gv\.at|admin\.ch|europa\.eu)$/;
export function isPublicHost(hostOrUrl: string): boolean {
  const parsed = parseDomain(hostOrUrl);
  const domain = registrableDomain(hostOrUrl);
  return parsed.ok && domain !== null && (PUBLIC_HOST.test(parsed.domain) || /(?:\.edu|\.(?:ac|edu)\.[a-z]{2})$/.test(domain));
}

/** A page for job seekers, by its host, its address or its title, in each
 *  language the product reads: a job board, a vacancy, a salary, a career
 *  or training path ("Baker | Your Career", "Ausbildung Bäcker/in"). */
const JOB_HOST = /^(jobs|careers?|karriere|stellen)\./;
const JOB_SEGMENT = /^(jobs?|job-details|vacanc(y|ies)|careers?|stellen(angebote)?|stellenmarkt|jobsuche)$/;
const JOB_TITLE =
  /(?<![\p{L}\p{N}])(jobs?|careers?|vacanc(y|ies)|salary|salaries|apprenticeships?|traineeships?|how to become|stellenangebote?|gehalt|ausbildung|emploi|empleos?|vacatures?)(?![\p{L}\p{N}])/iu;
/** A business whose market is job seekers: it recruits, staffs or trains. */
const JOB_TRADE = /(?<![\p{L}\p{N}])(recruit\p{L}*|staffing|headhunt\p{L}*|employment agenc\p{L}*|training|courses?|bootcamps?|personalvermittlung|zeitarbeit|weiterbildung|recrutement|intérim|reclutamiento|formación|werving|uitzend\p{L}*)(?![\p{L}\p{N}])/iu;

export function isJobRow(row: { domain: string; url?: string; title?: string }): boolean {
  const parsed = parseDomain(row.domain);
  if (parsed.ok && JOB_HOST.test(parsed.domain)) return true;
  if (row.title !== undefined && JOB_TITLE.test(row.title)) return true;
  try {
    return row.url !== undefined && new URL(row.url).pathname.toLowerCase().split("/").some((segment) => JOB_SEGMENT.test(segment));
  } catch {
    return false;
  }
}

/** Whether a search is a job seeker's: at least half its titled
 *  top ten are job pages. Never for a business that recruits, staffs or
 *  trains, as its own category says: job seekers are its buyers. */
export function isJobSearch(rows: readonly { domain: string; url?: string; title?: string }[], category: string | null | undefined): boolean {
  if (category != null && (JOB_TITLE.test(category) || JOB_TRADE.test(category))) return false;
  const titled = rows.slice(0, 10).filter((row) => row.title !== undefined);
  return titled.length > 0 && titled.filter(isJobRow).length * 2 >= titled.length;
}

/** The partition `deriveRivals` applies to a domain: a platform or listing,
 *  a public body or a school, a marketplace in a local market, or a
 *  listing's address. */
export function isSourceDomain(host: string, url: string | undefined, a: { local: boolean }): boolean {
  return (
    isPlatformDomain(host) ||
    isPublicHost(host) ||
    (a.local && isMarketplaceHost(host)) ||
    (url !== undefined && isListingAddress(url))
  );
}

/** A report's own reading of its searches: where it is local, which
 *  domains it set aside as sources, and which it names as rivals. */
export interface SourceReading {
  local: boolean;
  sources?: readonly string[];
  rivals?: readonly string[];
}

/** Whether a top-ten row is a source rather than a business that holds the
 *  search: a domain the rivals' partition sets aside or the report stored as
 *  a source, or a page for job seekers, an article about others or an
 *  explainer. A rival's row never is, whatever the page. Outside a local
 *  market an article in a domain's own blog is that business's. A row
 *  whose host does not parse is one. */
export function isSourceRow(row: { domain: string; url?: string; title?: string }, a: SourceReading): boolean {
  const domain = registrableDomain(row.domain);
  if (domain !== null && a.rivals?.includes(domain) === true) return false;
  if (domain === null || a.sources?.includes(domain) === true || isSourceDomain(row.domain, row.url, a) || isJobRow(row)) return true;
  const article = isArticleRow(row) || (row.title !== undefined && isExplainerTitle(row.title));
  return article && (a.local || row.url === undefined || !isOwnContentUrl(row.url));
}

/** Whether a domain is one of `MARKETPLACE_HOSTS`, or under one. */
export function isMarketplaceHost(hostOrUrl: string): boolean {
  const parsed = parseDomain(hostOrUrl);
  return parsed.ok && under(parsed.domain, MARKETPLACE_HOSTS) !== null;
}

/** True when `host` and `ownDomain` reduce to the same eTLD+1. That single
 *  rule already covers a `www.` prefix and the `content.` publishing
 *  subdomain — both reduce to the same registrable domain — so neither is
 *  special-cased here (BP-026 `## Error & edge behavior`: "matching on
 *  `www.` and on the `content.` publishing subdomain, so a customer's own
 *  hosted page never becomes their own rival"). A malformed `host` or
 *  `ownDomain` reduces to `null`, and `null === null` would be a false
 *  match, so both sides are required to parse. */
export function isOwnDomain(host: string, ownDomain: string): boolean {
  const a = registrableDomain(host);
  const b = registrableDomain(ownDomain);
  return a !== null && b !== null && a === b;
}

/** Words that join the parts of a name and are written either way: "A & B",
 *  "A and B". */
const JOINERS = new Set(["and", "und", "et", "y", "e", "en"]);

/** A name as letters only, accents folded, joining words left out: what a
 *  page and a domain both spell. */
export function nameLetters(text: string): string {
  return (text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => !JOINERS.has(word))
    .join("");
}
