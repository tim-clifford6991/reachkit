// SPEC.md §2 Rules ("The scan builds the site profile") · §12 ruling 8
// (2026-09-12) — "a purpose per page", over the closed set in `types.ts`.
//
// **Deterministic, total, and free.** One purpose per page, decided from
// the page's own address and its two headings. No model call: the ruling
// bounds the profile to one inference call for the voice summary, and a
// classification that spent a second one would put the 12¢ free ceiling in
// reach of a hundred pages. A rule table is also the arm a customer can
// argue with — a page filed as `blog` is filed that way because its path
// says `/blog/`, not because a model felt it.
//
// **The address outranks the words.** A site's own URL is the strongest
// statement of what a page is for: `/pricing` is the pricing page whatever
// its `<title>` says, and a marketing `<h1>` that opens "Pricing that
// scales" on a features page is exactly the mistake path-first avoids. The
// headings are consulted only where the path says nothing — a slug-only
// CMS address (`/p/9f2a`), or a root-level page named for the product.
//
// **`other` is the honest arm, never a dustbin for a miss.** The home page
// is `other` on purpose: it is the whole site's front door and claiming it
// as `product` or `about` would put a false row in the inventory that
// cross-linking (§7) would then link to as if it were a product page.
import type { PagePurpose } from "./types";

/** Path tokens, in the order they are tested. A page whose address carries
 *  one of these anywhere in its path takes that purpose; earlier rows win,
 *  so `/legal/pricing-terms` is `legal` (it is a legal document about
 *  pricing, not the pricing page) and `/blog/how-our-pricing-works` is
 *  `blog` (a post, not the pricing page).
 *
 *  Ordered most-specific first: the two arms a visitor reaches for by name
 *  (legal, contact) before the three commercial ones, and the editorial
 *  arm before the two that describe the product, because a post about a
 *  feature is a post. */
const PATH_RULES: readonly { purpose: PagePurpose; tokens: readonly string[] }[] = [
  {
    purpose: "legal",
    tokens: [
      "legal", "privacy", "terms", "imprint", "impressum", "cookies", "cookie-policy",
      "gdpr", "dpa", "data-protection", "disclaimer", "eula", "licence", "license",
    ],
  },
  { purpose: "contact", tokens: ["contact", "contact-us", "support", "help", "get-in-touch"] },
  { purpose: "pricing", tokens: ["pricing", "price", "prices", "plans", "plan", "cost"] },
  { purpose: "about", tokens: ["about", "about-us", "company", "team", "our-story", "story", "mission", "careers", "jobs"] },
  { purpose: "blog", tokens: ["blog", "news", "articles", "article", "posts", "post", "insights", "resources", "stories", "newsroom", "press"] },
  { purpose: "features", tokens: ["features", "feature", "capabilities", "how-it-works", "why", "platform", "tour"] },
  { purpose: "product", tokens: ["product", "products", "solutions", "solution", "use-cases", "use-case", "integrations", "integration", "apps", "modules", "services", "service"] },
];

/** Heading phrases, consulted only where the path decided nothing. Matched
 *  against the title and the `h1` together, lower-cased, as whole words —
 *  so "About" matches "About us" and "About ReachKit" but not "roundabout".
 *  Same precedence as the path table, and the same reason for it. */
const HEADING_RULES: readonly { purpose: PagePurpose; phrases: readonly string[] }[] = [
  { purpose: "legal", phrases: ["privacy policy", "privacy notice", "terms of service", "terms and conditions", "terms of use", "legal notice", "imprint", "impressum", "cookie policy"] },
  { purpose: "contact", phrases: ["contact us", "contact", "get in touch", "talk to us", "support"] },
  { purpose: "pricing", phrases: ["pricing", "prices", "our plans", "plans and pricing", "what it costs"] },
  { purpose: "about", phrases: ["about us", "about", "our story", "our team", "who we are", "our mission", "careers"] },
  { purpose: "blog", phrases: ["blog", "news", "press release", "case study"] },
  { purpose: "features", phrases: ["features", "how it works", "capabilities", "what you get"] },
  { purpose: "product", phrases: ["integrations", "use cases", "solutions", "our services"] },
];

/**
 * The one purpose this page carries. Total: every input returns a member
 * of the closed set, and an address that will not parse is `other` rather
 * than a throw — the crawl only ever hands this URLs it fetched, and a
 * classification is never the reason a pass fails.
 */
export function derivePurpose(a: { url: string; title: string; h1: string }): PagePurpose {
  const segments = pathSegments(a.url);

  // The home page: no segments at all. Its purpose is `other` — see the
  // header. Decided before the tables so a root address can never pick up
  // a token from a query-shaped path.
  if (segments.length === 0) return "other";

  for (const rule of PATH_RULES) {
    if (segments.some((segment) => rule.tokens.includes(segment))) return rule.purpose;
  }

  const headings = `${a.title} ${a.h1}`.toLowerCase();
  for (const rule of HEADING_RULES) {
    if (rule.phrases.some((phrase) => containsPhrase(headings, phrase))) return rule.purpose;
  }

  return "other";
}

/** The path's own segments, lower-cased, empties dropped. A URL that does
 *  not parse yields none, which lands on `other`. */
function pathSegments(url: string): readonly string[] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  return parsed.pathname
    .toLowerCase()
    .split("/")
    .map((segment) => segment.replace(/\.(?:html?|php|aspx?)$/, ""))
    .filter((segment) => segment.length > 0);
}

/** Whole-phrase match: the phrase must sit on word boundaries, so "about"
 *  does not match "roundabout" and "plan" does not match "planet". */
function containsPhrase(haystack: string, phrase: string): boolean {
  const at = haystack.indexOf(phrase);
  if (at < 0) return false;
  const before = at === 0 ? " " : haystack[at - 1] ?? " ";
  const afterIndex = at + phrase.length;
  const after = afterIndex >= haystack.length ? " " : haystack[afterIndex] ?? " ";
  return !isWordChar(before) && !isWordChar(after);
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9]/i.test(ch);
}
