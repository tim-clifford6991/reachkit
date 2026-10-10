// SPEC §5 (2026-09-29, #1133; reordered 2026-10-07, issue 1314): the pages
// that say what the business sells are read first.
//
// One ranking, read twice: by the crawl, to choose which of the addresses it
// found to spend its hundred pages and twelve seconds on, and by the
// knowledge read, to choose which of the pages it holds to ask about first.

/** Path words, best first. A page takes the rank of the first row one of
 *  its path segments names.
 *
 *  The order is what a buyer needs to know of any business, most telling
 *  first (2026-10-07, issue 1314): what it costs; what it sells; who it is,
 *  what its buyers ask and where it is; whom it has served; then its
 *  reference pages. A shop, a restaurant and a tradesperson name their
 *  pages differently from a software company, and a site written in German,
 *  French or Spanish names them in its own language. */
const READ_FIRST: readonly (readonly string[])[] = [
  ["pricing", "price", "prices", "plans", "plan", "rates", "fees", "preise", "tarifs", "precios"],
  [
    "features", "feature", "product", "products", "how-it-works", "platform", "solutions", "use-cases",
    "services", "service", "what-we-do", "menu", "menus", "shop", "store", "collections", "treatments",
    "leistungen", "angebot", "produkte", "sortiment", "speisekarte", "prestations", "servicios", "productos",
  ],
  [
    "about", "about-us", "company", "our-story", "team", "faq", "faqs", "questions", "locations", "location",
    "areas", "service-areas", "contact", "contact-us", "visit", "compare", "vs", "alternatives",
    "ueber-uns", "uber-uns", "über-uns", "unternehmen", "kontakt", "standorte", "filialen", "haeufige-fragen",
    "a-propos", "nosotros", "contacto",
  ],
  ["case-studies", "case-study", "customers", "customer-stories", "success-stories", "work", "projects", "portfolio", "referenzen"],
  ["reviews", "review", "testimonials", "testimonial", "wall-of-love", "bewertungen"],
  ["docs", "doc", "documentation", "guide", "guides", "help", "integrations", "integration"],
  ["changelog", "releases", "release-notes", "whats-new", "updates"],
];

/** Addresses that say nothing about what the business sells. */
const READ_LAST = ["legal", "privacy", "terms", "cookies", "imprint", "impressum", "login", "signin", "sign-in", "signup", "sign-up", "account", "cart", "checkout", "tag", "tags", "category", "author", "page", "careers", "jobs", "now-hiring", "karriere", "stellenangebote"];

/** Lower is read sooner. The home page is first of all; then each named
 *  section's own page; then the pages under a named section; a page no row
 *  names sits after those and before the ones read last. */
export function readFirstRank(url: string): number {
  let segments: string[];
  try {
    segments = decodeURIComponent(new URL(url).pathname)
      .toLowerCase()
      .split("/")
      .map((segment) => segment.replace(/\.(?:html?|php|aspx?)$/, ""))
      .filter((segment) => segment !== "");
  } catch {
    return READ_FIRST.length + 2;
  }
  if (segments.length === 0) return 0;
  if (segments.some((segment) => READ_LAST.includes(segment)) || isNeverRead(url)) return READ_FIRST.length + 2;
  const row = READ_FIRST.findIndex((words) => segments.some((segment) => words.includes(segment)));
  if (row < 0) return READ_FIRST.length + 1;
  // A section's own page before any page under one: `/pricing`, `/about`
  // and `/faq` before `/products/blue-widget` and `/docs/api/webhooks`. A
  // read bounded to twenty pages (issue 1314) would otherwise spend them
  // all on one section's entries.
  return segments.length === 1 ? row + 1 : READ_FIRST.length + (row + 1) / 10;
}

/** Whether an address is one of those read last: a legal, account, tag or
 *  hiring page, or one never read at all. */
export function isReadLast(url: string): boolean {
  return readFirstRank(url) >= READ_FIRST.length + 2;
}

/** Path words of a gallery: a listing of other businesses, and the entries
 *  under it (reachkit.app's `/scans`, and each report at `/scan/<domain>`).
 *  What such a page says is about them, never about the business whose site
 *  it is on (§5, 2026-10-04, issue 1249). */
const GALLERY = ["scans", "gallery", "galleries", "showcase", "directory", "listings"];
/** A word that is a gallery only with an entry under it: `/scan` alone may
 *  be the page of a product that scans. */
const GALLERY_ENTRY = ["scan"];

/** Whether an address is never read for facts about the business: a gallery
 *  page, with or without a sort or filter on its address. */
export function isNeverRead(url: string): boolean {
  try {
    const segments = new URL(url).pathname
      .toLowerCase()
      .split("/")
      .filter((segment) => segment !== "");
    return segments.some(
      (segment, i) => GALLERY.includes(segment) || (GALLERY_ENTRY.includes(segment) && i < segments.length - 1)
    );
  } catch {
    return false;
  }
}
