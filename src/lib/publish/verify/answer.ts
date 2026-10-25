// BUILD §9 — the one place an answer from a published page's own address becomes one of REQ-062 c4's three outcomes.
// Pure: `verify.ts` makes the one `safeFetch`, so ADR-085's whitelist lives in one file.
// A whitelist of two statuses, never a blacklist (ADR-085): only 404 and 410 are `page_not_found`, which retires a page
// for ever; everything else falls to `could_not_confirm`, which asserts nothing. `answer.test.ts`'s status sweep holds it.
// `could_not_confirm` is final and never retried: `dueNow` selects only rows with no recorded outcome.
// Identity is not readability: it comes from the document's own canonical, `og:url` or `<title>`, so a JavaScript-gated
// page stays `found` and fails the readability check. This module never imports `bodyCoverage`.
// A CMS with none of the three reads as `not_our_page`: the safe direction, asserting nothing.
import type { NotConfirmed } from "../types";

/** One fetch of the page's own address; `status: null` is no HTTP answer at all, for whatever reason. */
export interface Answer {
  status: number | null;
  /** After redirects. Null where nothing answered. */
  finalUrl: string | null;
  requestedUrl: string;
  html: string | null;
  publishedTitle: string;
}

export type ClassifiedAnswer =
  | { outcome: "found"; html: string }
  | { outcome: "page_not_found"; status: 404 | 410 }
  | { outcome: "could_not_confirm"; why: NotConfirmed };

/** "There is no such page", enumerated; a third member fails the generated sweep. */
const NO_SUCH_PAGE: readonly number[] = [404, 410];

/** Origin and path, host lowercased, trailing slash, query and fragment dropped: `?utm_source=…` is not a redirect
 *  away, and one that leaves the page changes the path or host. */
function sameAddress(a: string, b: string): boolean {
  const normalise = (value: string): string | null => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.hostname.toLowerCase()}${path}`;
  };
  const left = normalise(a);
  const right = normalise(b);
  return left !== null && right !== null && left === right;
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  if (match === null) return null;
  return match[1] ?? match[2] ?? null;
}

/** The first `<link rel="canonical">`'s `href`, or null; `rel` may carry several tokens. */
function canonicalHref(html: string): string | null {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attribute(tag, "rel");
    if (rel === null) continue;
    if (!rel.toLowerCase().split(/\s+/).includes("canonical")) continue;
    const href = attribute(tag, "href");
    if (href !== null && href !== "") return href;
  }
  return null;
}

/** The `content` of the first `<meta property="og:url">`. */
function openGraphUrl(html: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const property = attribute(tag, "property") ?? attribute(tag, "name");
    if (property === null || property.toLowerCase() !== "og:url") continue;
    const content = attribute(tag, "content");
    if (content !== null && content !== "") return content;
  }
  return null;
}

function documentTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match === null ? null : (match[1] ?? null);
}

/** Lowercase words; a `<title>` usually carries the site's name, so the published title's words need only be present. */
function titleWords(value: string): string[] {
  return value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function resolve(href: string, against: string): string | null {
  try {
    return new URL(href, against).toString();
  } catch {
    return null;
  }
}

/** Is this the page we published, whether or not its body reads? A declared canonical or `og:url` stands, so a
 *  template reusing the title is not ours; only with neither is the `<title>` consulted. */
export function isOurPage(
  html: string,
  a: { requestedUrl: string; publishedTitle: string }
): boolean {
  const declared = canonicalHref(html) ?? openGraphUrl(html);
  if (declared !== null) {
    const absolute = resolve(declared, a.requestedUrl);
    return absolute !== null && sameAddress(absolute, a.requestedUrl);
  }

  const title = documentTitle(html);
  if (title === null) return false;
  const wanted = titleWords(a.publishedTitle);
  if (wanted.length === 0) return false;
  const found = new Set(titleWords(title));
  return wanted.every((word) => found.has(word));
}

/** The three outcomes from one answer: status, then address, then identity. The final `return` is unconditional, so
 *  the bottom is `could_not_confirm` structurally, never by a reorderable `default:`. */
export function classify(a: Answer): ClassifiedAnswer {
  if (a.status === null) return { outcome: "could_not_confirm", why: "unreachable" };

  if (NO_SUCH_PAGE.includes(a.status)) {
    return { outcome: "page_not_found", status: a.status as 404 | 410 };
  }

  if (a.status < 200 || a.status >= 300) {
    // REQ-062 c4's "the address returned a server error": a 403 or 451 told us nothing about the page either.
    return { outcome: "could_not_confirm", why: "server_error" };
  }

  if (a.finalUrl === null || !sameAddress(a.finalUrl, a.requestedUrl)) {
    return { outcome: "could_not_confirm", why: "redirected_away" };
  }

  if (a.html !== null && isOurPage(a.html, a)) {
    return { outcome: "found", html: a.html };
  }

  return { outcome: "could_not_confirm", why: "not_our_page" };
}
