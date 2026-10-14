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
 * Sites that list, sell, review or write about other businesses — app
 * stores, directories, marketplaces, review sites, social networks and
 * publishers — and are never a business's rival (SPEC §0 Rival, D24;
 * issue 1417). A closed list of the ones a top ten or an AI answer most
 * often holds in the product's countries. An entry with a subdomain
 * (`apps.apple.com`) is that host and the ones under it, never the rest of
 * its registrable domain: Apple's own products stay at `apple.com`. The
 * customer panel judges its rivals against this same list.
 */
export const LISTING_HOSTS: ReadonlySet<string> = new Set(
  (
    "yelp.com yelp.co.uk tripadvisor.com tripadvisor.co.uk tripadvisor.de google.com facebook.com instagram.com linkedin.com " +
    "youtube.com tiktok.com x.com twitter.com pinterest.com reddit.com quora.com wikipedia.org medium.com substack.com " +
    "amazon.com amazon.co.uk amazon.de ebay.com ebay.co.uk ebay.de etsy.com walmart.com otto.de zalando.de idealo.de " +
    "g2.com capterra.com getapp.com softwareadvice.com trustpilot.com trustradius.com producthunt.com clutch.co sortlist.com " +
    "goodfirms.co designrush.com upwork.com fiverr.com angi.com angieslist.com homeadvisor.com thumbtack.com houzz.com " +
    "bbb.org yellowpages.com nextdoor.com checkatrade.com trustatrader.com mybuilder.com ratedpeople.com bark.com yell.com " +
    "freeindex.co.uk which.co.uk gelbeseiten.de dasoertliche.de 11880.com golocal.de kennstdueinen.de jameda.de doctolib.de " +
    "myhammer.de check24.de zocdoc.com healthgrades.com webmd.com treatwell.co.uk treatwell.de fresha.com booksy.com " +
    "opentable.com opentable.co.uk thefork.com resy.com doordash.com ubereats.com grubhub.com deliveroo.co.uk lieferando.de " +
    "booking.com expedia.com airbnb.com eater.com timeout.com infatuation.com michelin.com udemy.com coursera.org " +
    "skillshare.com apps.apple.com play.google.com forbes.com nytimes.com theguardian.com techcrunch.com nerdwallet.com " +
    "legal500.com chambers.com lawsociety.org.uk icaew.com unbiased.co.uk " +
    "apps.microsoft.com apps.shopify.com marketplace.atlassian.com alternativeto.net saasworthy.com f-droid.org"
  ).split(" ")
);

/** Whether `host` is one of `LISTING_HOSTS`, or under one. Read on the host
 *  as written, so `apps.apple.com` is a store and `apple.com` is not. */
export function isListingHost(hostOrUrl: string): boolean {
  const parsed = parseDomain(hostOrUrl);
  if (!parsed.ok) return false;
  for (const listing of LISTING_HOSTS) {
    if (parsed.domain === listing || parsed.domain.endsWith(`.${listing}`)) return true;
  }
  return false;
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
const ARTICLE_SECTION = /^(blogs?|articles?|news|guides?|resources?|resource-hub|learn|insights|magazine|posts?|reviews?|best|top)$/;
const ARTICLE_WORD = /(^|[-_])(best|top-?\d+|alternatives?|vs|versus|reviews?|compared|comparison|guide)($|[-_.])/;

/** Whether an address is an article page (issue 1417): a domain cited for
 *  one is cited as a publisher of a list, not recommended as a product.
 *  Anything that does not parse as an address is not one. */
export function isArticleUrl(url: string): boolean {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return false;
  }
  const segments = path.split("/").filter(Boolean);
  return segments.some((segment) => ARTICLE_SECTION.test(segment) || ARTICLE_WORD.test(segment));
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
