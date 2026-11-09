// The Content-Security-Policy every ReachKit page is answered under. Shared by
// `src/middleware.ts`, which mints the per-request nonce, and `next.config.ts`,
// which states the fixed policy of the pages served static from the CDN.
//
// Every string here is internal: directive names and the origins they name.
import { createHash } from "node:crypto";
import { THEME_SCRIPT } from "../_theme/theme";

/** Vercel's preview toolbar, which the platform injects into a preview
 *  deployment's HTML. Production never gets the toolbar, so its policy names
 *  none of these. */
const VERCEL_LIVE = "https://vercel.live";
const VERCEL_LIVE_IMG = "https://vercel.com";
const VERCEL_LIVE_FONTS = "https://assets.vercel.com";
const VERCEL_LIVE_SOCKET = "wss://ws-us3.pusher.com";

/** `form-action` is enforced across the redirect that follows a POST, and
 *  `/pricing`'s control redirects to Stripe Checkout, so a JavaScript-free
 *  checkout needs these named. */
const STRIPE_CHECKOUT = "https://checkout.stripe.com";
const STRIPE_BILLING = "https://billing.stripe.com";

/** The root document's before-paint theme script, by hash: a page rendered
 *  per request no longer reads its nonce to stamp it. */
const THEME_HASH = `'sha256-${createHash("sha256").update(THEME_SCRIPT).digest("base64")}'`;

/** How a page's scripts are allowed: by this request's nonce; by origin and
 *  inline, on the static pages, which reflect no input; or not at all, on the
 *  cached hosted article, which has no script. */
export type ScriptRule = { nonce: string } | "inline" | "none";

/**
 * The policy a page is answered under.
 *
 * With a nonce, `script-src` has no `'unsafe-inline'`: an injected script does
 * not run. `'strict-dynamic'` is absent because it would make `'self'` inert.
 * Inline, no hash is listed beside `'unsafe-inline'`, because a browser that
 * sees one ignores `'unsafe-inline'`.
 *
 * `style-src` keeps `'unsafe-inline'`: no nonce reaches a `style="…"`
 * attribute. `upgrade-insecure-requests` is absent; HSTS does its job.
 */
export function contentSecurityPolicy(script: ScriptRule, isDev: boolean, siteIcons = false, toolbar = true): string {
  const live = (...origins: string[]): string => (toolbar ? ` ${origins.join(" ")}` : "");
  const allowed = script === "inline" ? "'unsafe-inline'" : script === "none" ? "" : `'nonce-${script.nonce}' ${THEME_HASH}`;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `form-action 'self' ${STRIPE_CHECKOUT} ${STRIPE_BILLING}`,
    // React reconstructs server stacks with `eval` in development and nowhere else.
    script === "none" ? "script-src 'none'" : `script-src 'self' ${allowed}${live(VERCEL_LIVE)}${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'${live(VERCEL_LIVE)}`,
    `img-src 'self' data: blob:${live(VERCEL_LIVE, VERCEL_LIVE_IMG)}${siteIcons ? " https:" : ""}`,
    `font-src 'self'${live(VERCEL_LIVE, VERCEL_LIVE_FONTS)}`,
    `connect-src 'self'${live(VERCEL_LIVE, VERCEL_LIVE_SOCKET)}${isDev ? " ws:" : ""}`,
    `frame-src 'self'${live(VERCEL_LIVE)}`,
  ].join("; ");
}

/** The public pages served static: no request value reaches their render.
 *  `src/middleware.ts`'s `matcher` restates these two lists as literals,
 *  because Next reads that `config` from source. */
const PAGES = "pricing|about|how-it-works|privacy|terms|imprint|compare|teardowns|tools";
const PAGES_UNDER = "compare|teardowns|answers";

/** The static pages as a `headers()` source. */
export const STATIC_PAGES_SOURCE = `/((?:${PAGES})?|(?:${PAGES_UNDER})/[^/]+)`;

const STATIC_PAGE = new RegExp(`^/(?:(?:${PAGES})?|(?:${PAGES_UNDER})/[^/]+)$`);

export function isStaticPage(pathname: string): boolean {
  return STATIC_PAGE.test(pathname);
}
