// SPEC §9 — what one crawled page tells the technical-issue checks.
//
// Read off the document the crawl already fetched: no second fetch, no
// script execution. The `noindex` and structured-data readings are
// `parseOnPage`'s, so a page is judged by the same parser the score reads;
// the meta description and the viewport are the two tags that parser has no
// reason to read.
import { parse } from "node-html-parser";
import { AI_READER_AGENTS } from "@/lib/config/constants";
import { asciiLowerCase, MARKUP_OPTIONS, parseOnPage } from "@/lib/measure/parse";
import { identityOf, type Identity } from "@/lib/business/identity";

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
  /** The page forbids the snippet an AI answer is built from (SPEC §9,
   *  2026-09-29, D14): `nosnippet` or `max-snippet:0` for every reader or
   *  for an answer reader, or `data-nosnippet` on the main content. Absent
   *  on a page read before issue 1145, which claims nothing. */
  snippetBlocked?: boolean;
  /** Who the page's structured data says runs the site; `null` where none
   *  says so. Absent on a page read before issue 1915, which claims nothing. */
  identity?: Identity | null;
}

/** `<meta name>` values whose robots rules reach an answer reader: every
 *  reader, or one answer reader by name. */
const SNIPPET_META_NAMES: ReadonlySet<string> = new Set([
  "robots",
  ...AI_READER_AGENTS.map((agent) => asciiLowerCase(agent)),
]);

/** The elements Google reads `data-nosnippet` on. */
const NOSNIPPET_SELECTOR = "div[data-nosnippet], span[data-nosnippet], section[data-nosnippet]";
/** The share of the main content's text a `data-nosnippet` must cover. */
const MAIN_CONTENT_SHARE = 0.5;

function forbidsSnippet(content: string): boolean {
  const rules = asciiLowerCase(content).split(",").map((rule) => rule.replace(/\s+/g, ""));
  return rules.includes("nosnippet") || rules.includes("max-snippet:0");
}

/** `data-nosnippet` around the main content: on an element that holds the
 *  page's `<main>`, or over at least half of the main content's text. A
 *  marked aside or a single price is not the page. */
function mainContentHidden(html: string): boolean {
  if (!/data-nosnippet/i.test(html)) return false;
  const root = parse(html);
  const main = root.querySelector("main") ?? root.querySelector('[role="main"]') ?? root.querySelector("body") ?? root;
  if (main.closest(NOSNIPPET_SELECTOR) !== null) return true;
  const total = main.textContent.replace(/\s+/g, "").length;
  if (total === 0) return false;
  let hidden = 0;
  for (const marked of main.querySelectorAll(NOSNIPPET_SELECTOR)) {
    // A marked element inside another is already counted with its parent.
    if (marked.parentNode?.closest(NOSNIPPET_SELECTOR)) continue;
    hidden += marked.textContent.replace(/\s+/g, "").length;
  }
  return hidden / total >= MAIN_CONTENT_SHARE;
}

const COMMENT_RE = /<!--[\s\S]*?-->/g;

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
  let snippetBlocked = false;
  for (const tag of parse(withoutComments, MARKUP_OPTIONS).querySelectorAll("meta")) {
    const name = asciiLowerCase(tag.getAttribute("name") ?? "");
    // As written, so a stored page reads the facts it read before the parser (issue 2293).
    const value = Object.entries(tag.rawAttributes).find(([key]) => asciiLowerCase(key) === "content")?.[1] ?? "";
    if (SNIPPET_META_NAMES.has(name) && forbidsSnippet(value)) {
      snippetBlocked = true;
    }
    if (name === "description" && metaDescription === "") {
      metaDescription = decode(value);
    } else if (name === "viewport") {
      const content = asciiLowerCase(value).replace(/\s+/g, "");
      if (content.includes("width=device-width")) phoneViewport = true;
    }
  }

  return {
    metaDescription,
    noindex: onPage.noindex && onPage.noindexAppliesToEveryReader,
    phoneViewport,
    schemaTypes: onPage.schemaTypes.length,
    snippetBlocked: snippetBlocked || mainContentHidden(withoutComments),
    identity: identityOf(onPage.schemaTypes),
  };
}
