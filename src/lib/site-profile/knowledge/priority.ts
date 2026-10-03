// SPEC §5 (2026-09-29, #1133): the profile crawl reads "pricing, features,
// docs, changelog, case studies, reviews and testimonials first".
//
// One ranking, read twice: by the crawl, to choose which of the addresses it
// found to spend its hundred pages and twelve seconds on, and by the
// knowledge read, to choose which of the pages it holds to ask about first.

/** Path words, best first. A page takes the rank of the first row one of
 *  its path segments names. */
const READ_FIRST: readonly (readonly string[])[] = [
  ["pricing", "price", "prices", "plans", "plan"],
  ["features", "feature", "product", "products", "how-it-works", "platform", "solutions", "use-cases"],
  ["docs", "doc", "documentation", "guide", "guides", "help", "integrations", "integration"],
  ["changelog", "releases", "release-notes", "whats-new", "updates"],
  ["case-studies", "case-study", "customers", "customer-stories", "success-stories"],
  ["reviews", "review", "testimonials", "testimonial", "wall-of-love"],
  ["about", "about-us", "company", "faq", "faqs", "compare", "vs", "alternatives"],
];

/** Addresses that say nothing about what the business sells. */
const READ_LAST = ["legal", "privacy", "terms", "cookies", "imprint", "impressum", "login", "signin", "sign-in", "signup", "sign-up", "account", "cart", "checkout", "tag", "tags", "category", "author", "page"];

/** Lower is read sooner. The home page is first of all; a page no row
 *  names sits after every named one and before the ones read last. */
export function readFirstRank(url: string): number {
  let segments: string[];
  try {
    segments = new URL(url).pathname
      .toLowerCase()
      .split("/")
      .map((segment) => segment.replace(/\.(?:html?|php|aspx?)$/, ""))
      .filter((segment) => segment !== "");
  } catch {
    return READ_FIRST.length + 2;
  }
  if (segments.length === 0) return 0;
  if (segments.some((segment) => READ_LAST.includes(segment))) return READ_FIRST.length + 2;
  const row = READ_FIRST.findIndex((words) => segments.some((segment) => words.includes(segment)));
  if (row < 0) return READ_FIRST.length + 1;
  // A section's own page before the pages under it: `/pricing` before
  // `/docs/api/pricing-webhooks`.
  return row + 1 + (segments.length > 1 ? 0.5 : 0);
}
