// BUILD §9 — the one place an answer from a published page's own public
// address becomes one of REQ-062 criterion 4's three outcomes.
//
// Pure: no fetch, no clock, no database. `verify.ts` makes the one
// `safeFetch` and hands the answer here, which is what keeps ADR-085's
// whitelist in a single file.
//
// **A whitelist of two statuses, never a blacklist of failures — ADR-085
// (landmine).** `404` and `410`, and no other answer, are `page_not_found`.
// Everything else — including a status this function does not recognise —
// falls through to `could_not_confirm`, because the default arm must be the
// one that asserts nothing. A blacklist ("anything that is not a 2xx is
// page_not_found, except …") is indistinguishable from this on every
// hand-written fixture and fails only the generated status sweep in
// `tests/publish/verify/answer.test.ts`. The consequence of getting it
// wrong is not cosmetic: `page_not_found` stops a page being shown as live
// and retires it from weekly judgement forever, and `could_not_confirm`
// costs nothing.
//
// **`could_not_confirm` is final, not pending, and is never retried.**
// Nothing here schedules anything — the promise is held by `dueNow`
// (`due.ts`) selecting only rows with no recorded outcome. It is named here
// because a reader of this file is exactly the person who will think a
// transport failure deserves a second look.
//
// **Identity is not readability, and one number cannot decide both**
// (`coverage.ts`'s header states the other half). Identity is decided from
// the document's *own declaration of itself* — a canonical link, an
// `og:url`, or failing both a normalised `<title>` — which a CMS emits in
// server-rendered markup even where it withholds the body. That is what
// keeps a JavaScript-gated page inside `found`, failing the one check that
// exists to catch it, instead of disappearing into `not_our_page`. This
// module never imports `bodyCoverage`, and a source assertion holds it.
//
// The failure direction is chosen and recorded: a page whose CMS emits no
// canonical, no `og:url` and a rewritten title reads as `not_our_page` when
// it is in fact ours. That is the safe direction — it asserts nothing.
//
// The archived plan is WO-261.
import type { NotConfirmed } from "../types";

/** What one fetch of the page's own address came back as. `status: null`
 *  means no HTTP answer at all — a DNS failure, a refused connection, a
 *  timeout, a policy refusal: this module does not care which, only that
 *  nothing answered. */
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

/** The two statuses that mean "there is no such page", enumerated. Adding a
 *  third member here is the change the generated sweep in the test fails. */
const NO_SUCH_PAGE: readonly number[] = [404, 410];

/** Origin plus path, lowercased host, one trailing slash removed, query and
 *  fragment dropped.
 *
 *  Dropping the query is deliberate and is the looser of the two available
 *  mistakes: a CMS that answers the same page at `?utm_source=…` has not
 *  redirected the reader away from it, and reading that as
 *  `redirected_away` would put a correctly published page in the arm that
 *  asserts nothing about it. A redirect that genuinely leaves the page
 *  changes the path or the host, which this comparison sees. */
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

/** The `href` of the first `<link rel="canonical">`, or null where the
 *  document declares none. `rel` may carry several tokens. */
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

/** Lowercase alphanumeric words, joined. A `<title>` almost always carries
 *  the site's name after a separator, so the comparison asks whether the
 *  published title's words are all present in it rather than whether the
 *  two strings are equal. */
function titleWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function resolve(href: string, against: string): string | null {
  try {
    return new URL(href, against).toString();
  } catch {
    return null;
  }
}

/**
 * Is this document the page ReachKit published, independently of whether
 * its body can be read?
 *
 * Canonical link first, then `og:url`; **where the document declares either
 * of those, its answer stands** — a canonical that points somewhere else is
 * the document saying it is a different page, and falling through to a
 * title match would let a template that reuses the site's title read as
 * ours. Only where the document declares neither is the normalised
 * `<title>` consulted.
 */
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

/**
 * REQ-062 criterion 4's three outcomes, from one answer.
 *
 * The order is status, then address, then identity: identity is asked only
 * of a 2xx that actually answered at the address we asked for.
 *
 * The final `return` is unconditional on purpose. An answer that reaches
 * the bottom of this function is `could_not_confirm` structurally, not by a
 * `default:` clause somebody can reorder.
 */
export function classify(a: Answer): ClassifiedAnswer {
  if (a.status === null) return { outcome: "could_not_confirm", why: "unreachable" };

  if (NO_SUCH_PAGE.includes(a.status)) {
    return { outcome: "page_not_found", status: a.status as 404 | 410 };
  }

  if (a.status < 200 || a.status >= 300) {
    // Every other status the address answered with. Named `server_error`
    // because REQ-062 criterion 4 lists "the address returned a server
    // error" as one of its four cases and `NotConfirmed` has four members;
    // a 403 or a 451 is that case as far as this page is concerned — the
    // address answered with an error and told us nothing about the page.
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
