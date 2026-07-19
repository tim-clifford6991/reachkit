/**
 * Fetch-quality — the garbage-fetch detector (Part C, the x.com class).
 *
 * Evidence this closes: x.com's fetched `<title>` is literally "x.com" (no
 * real brand recoverable), the extract layer mistook the shell for "a browser
 * extension", `brandPct` was stuck at 0, and earlier scans produced garbage
 * competitor names from the same empty capture. linear.app has historically
 * scored SEO=0 off the same class of page — a raw `curl`/fetch of a
 * client-rendered SPA returns its pre-hydration bootstrap shell, not the
 * content a browser would actually show a visitor.
 *
 * `isGarbageFetch` is PURE and dependency-light (node-html-parser only) so it
 * unit-tests in node with hand-authored fixtures. This task has no prod DB
 * access (can't pull the real x.com/linear.app `raw_documents` capture), so
 * the calibration below is first-principles: each marker documents WHY it is
 * a reliable class signal, not a domain-specific tuning. See
 * `fetch-quality.test.ts` for the exact fixture shapes each one guards.
 */
import { parse } from "node-html-parser";

export interface GarbageFetchInput {
  html: string;
  text: string;
  /**
   * The page's own resolved title (e.g. via `parseListingHtml`, which already
   * falls back to the hostname when no `<title>` is present). Omit entirely
   * for content that has no title concept — e.g. Tavily Extract's rendered
   * markdown, used to re-validate the ONE escalation this module triggers.
   * Omitting skips the title==host/empty check rather than auto-failing
   * content that was never going to carry a `<title>`.
   */
  title?: string;
  host: string;
}

/** Below this, a "page" is functionally blank — not enough content for any
 *  downstream signal (SEO, identity, positioning) to be measured honestly. */
const MIN_TEXT_CHARS = 400;

/**
 * Marker 1 — the near-universal CSR `<noscript>` fallback text every
 * Create-React-App / Vite / Vue-CLI / Angular bootstrap ships verbatim
 * ("You need to enable JavaScript to run this app."). A server-rendered page
 * never needs to say this to a bot that already fetched its HTML over plain
 * HTTP — its mere presence in the raw markup (BEFORE stripping `<noscript>`
 * for the visible-text check) is a direct admission "this page does nothing
 * without client-side JS".
 */
const ENABLE_JS_MARKER = /enable javascript/i;

/**
 * Marker 2 — an effectively-empty CSR mount node: `<div id="root|app|
 * __next|__nuxt"></div>` with no children. This is the exact DOM node a CSR
 * framework's runtime mounts INTO once its JS bundle executes; present but
 * childless is the fingerprint of "the shell shipped, the app never ran" —
 * literally what a plain `fetch()` (no headless browser) sees for x.com and
 * (historically, the SEO=0 finding) linear.app. A hydrated/SSR'd page has
 * real children inside this node, so this does not fire on a healthy SPA
 * that pre-rendered its first paint.
 */
const EMPTY_MOUNT_DIV_RE = /<div[^>]*\bid=["'](?:root|app|__next|__nuxt)["'][^>]*>\s*<\/div>/i;

/** Strip non-content nodes and collapse whitespace — the visible text a
 *  reader (not a JS-executing browser) would see. Never throws: a parse
 *  failure degrades to a naive tag-strip so the caller always gets *some*
 *  text length signal instead of an exception mid-collect. */
export function visibleTextFromHtml(html: string): string {
  try {
    const root = parse(html);
    root.querySelectorAll("script,style,noscript,svg,template").forEach((n) => n.remove());
    return root.text.replace(/\s+/g, " ").trim();
  } catch {
    return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

/**
 * True when the fetched content is unusable for downstream measurement — the
 * page is GARBAGE when any of:
 *   1. visible text < 400 chars (functionally blank)
 *   2. `title` (trimmed/lowercased) is empty, or equals the bare host
 *      (www-stripped) — the page never resolved past "this is just the URL"
 *   3. a known JS-shell marker is present in the raw HTML
 *
 * `title` is optional — omit it when re-validating content that has no title
 * concept (the escalated Tavily Extract text); only the length + marker
 * checks apply in that case.
 */
export function isGarbageFetch(input: GarbageFetchInput): boolean {
  const text = (input.text ?? "").trim();
  if (text.length < MIN_TEXT_CHARS) return true;

  if (input.title !== undefined) {
    const title = input.title.trim().toLowerCase();
    const host = (input.host ?? "").trim().toLowerCase().replace(/^www\./, "");
    if (title.length === 0) return true;
    if (host.length > 0 && title === host) return true;
  }

  const html = input.html ?? "";
  if (ENABLE_JS_MARKER.test(html)) return true;
  if (EMPTY_MOUNT_DIV_RE.test(html)) return true;

  return false;
}
