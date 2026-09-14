// SPEC §9 — what one crawled page tells the technical-issue checks.
//
// Read off the document the crawl already fetched: no second fetch, no
// script execution. The `noindex` and structured-data readings are
// `parseOnPage`'s, so a page is judged by the same parser the score reads;
// the meta description and the viewport are the two tags that parser has no
// reason to read.
import { asciiLowerCase, parseOnPage } from "@/lib/measure/parse";

export interface PageIssueFacts {
  /** The `<meta name="description">` content, trimmed; empty where absent. */
  metaDescription: string;
  /** The page tells *every* reader not to index it. A `noindex` that names
   *  one reader is that reader's business, not a page kept out of search. */
  noindex: boolean;
  /** A `<meta name="viewport">` that sizes the page to the device. Without
   *  one a phone draws the desktop layout shrunk to fit. */
  phoneViewport: boolean;
  /** How many structured-data types the page declares. */
  schemaTypes: number;
}

const COMMENT_RE = /<!--[\s\S]*?-->/g;
const META_RE = /<meta\b[^>]*>/gi;

/** One attribute's value off a tag, either quote style; `null` where the tag
 *  does not carry it. */
function attribute(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = re.exec(tag);
  if (match === null) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function decode(value: string): string {
  return value
    .replace(/&(?:amp|AMP);/g, "&")
    .replace(/&(?:quot|QUOT);/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&(?:lt|LT);/g, "<")
    .replace(/&(?:gt|GT);/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function readPageFacts(url: string, html: string): PageIssueFacts {
  const onPage = parseOnPage({ url, html });
  const withoutComments = html.replace(COMMENT_RE, "");

  let metaDescription = "";
  let phoneViewport = false;
  META_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = META_RE.exec(withoutComments)) !== null) {
    const tag = match[0];
    const name = asciiLowerCase(attribute(tag, "name") ?? "");
    if (name === "description" && metaDescription === "") {
      metaDescription = decode(attribute(tag, "content") ?? "");
    } else if (name === "viewport") {
      const content = asciiLowerCase(attribute(tag, "content") ?? "").replace(/\s+/g, "");
      if (content.includes("width=device-width")) phoneViewport = true;
    }
  }

  return {
    metaDescription,
    noindex: onPage.noindex && onPage.noindexAppliesToEveryReader,
    phoneViewport,
    schemaTypes: onPage.schemaTypes.length,
  };
}
