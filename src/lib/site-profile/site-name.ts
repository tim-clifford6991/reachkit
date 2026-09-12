// SPEC.md §2 Rules ("The scan builds the site profile" — "the site name")
// and §12 ruling 8 (2026-09-12).
//
// The site's name, read off its own home document and nothing else.
//
// **Why this is not the model's job on the free path.** Ruling 8 puts the
// profile in the free scan, and the free pass's inference budget is spent:
// two nano calls already hold half the invocation the platform allows it
// (`FREE_PASS_INFERENCE_CALLS`, `INFERENCE_TIMEOUT_MS`). A site's name is
// not an inference anyway — it is a value the site publishes about itself,
// in two places that exist precisely to carry it. So it is read, not
// asked for, and a free scan stores a name like every other page fact.
//
// **Two sources, in the order a site means them.** `og:site_name` is the
// site naming itself for other machines and is taken whole. Failing that,
// the `<title>` — but a title is usually the *page's* name with the site's
// appended after a separator ("Pricing — Example Payments"), so the tail
// after the last separator is the site and the head is the page. A title
// with no separator is taken whole: a home page titled "Example Payments"
// is the ordinary case and its name is the whole string.
//
// Deterministic and total: any string answers, and a document that names
// itself nowhere answers `null` rather than a guess. A name nobody
// published is a name ReachKit does not have.

/** The separators a site suffix hangs off, as one class. Hyphen-minus is
 *  deliberately absent: "Pay-as-you-go invoicing" is one phrase, not a
 *  page and a site, and en dash / em dash / pipe / middot / colon are what
 *  a title template actually uses. */
const SEPARATOR_RE = /\s[–—|·:]\s/g;

/** `<meta property="og:site_name" content="…">`, in either attribute
 *  order, single or double quoted. */
const OG_SITE_NAME_RE =
  /<meta[^>]*?(?:property|name)\s*=\s*["']og:site_name["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/i;
const OG_SITE_NAME_REVERSED_RE =
  /<meta[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?(?:property|name)\s*=\s*["']og:site_name["'][^>]*>/i;

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

/** Whitespace folded and entities a title commonly carries decoded. The
 *  five that matter; anything else is left as written rather than
 *  half-decoded. */
function clean(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The site's own name out of a page title, by dropping the page's half.
 *
 * Exported because the crawl's inventory carries titles but not markup:
 * where the caller holds no home document it still holds the home page's
 * title, and the same rule applies to it.
 */
export function siteNameFromTitle(title: string): string | null {
  const cleaned = clean(title);
  if (cleaned === "") return null;

  SEPARATOR_RE.lastIndex = 0;
  const parts = cleaned.split(SEPARATOR_RE).map((part) => part.trim()).filter((part) => part !== "");
  if (parts.length === 0) return null;
  // The last part is the site's: title templates append the site, never
  // prepend it. One part means the title is the name.
  const last = parts[parts.length - 1];
  return last === undefined || last === "" ? null : last;
}

/**
 * The site's name as its home document publishes it, or `null` where it
 * publishes none.
 */
export function siteNameOf(html: string): string | null {
  const og = OG_SITE_NAME_RE.exec(html) ?? OG_SITE_NAME_REVERSED_RE.exec(html);
  const declared = og === null ? "" : clean(og[1] ?? "");
  if (declared !== "") return declared;

  const title = TITLE_RE.exec(html);
  return title === null ? null : siteNameFromTitle(title[1] ?? "");
}
