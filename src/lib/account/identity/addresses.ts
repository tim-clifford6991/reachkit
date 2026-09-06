// src/lib/account/identity/addresses.ts — BUILD §13
//
// The three names identity and the surfaces around it must agree on: the
// session cookie's wire name, where a sign-in link points, and the marker
// that puts REQ-098 criterion 7's line on the sign-in screen.
//
// **This module imports nothing, and that is load-bearing.**
// `src/middleware.ts` runs on the Edge runtime and reads the cookie's name
// on every request; every other file in this directory pulls `node:crypto`
// and `env`, neither of which Edge carries. A leaf with no imports is what
// lets the one allow-list and the one issuer share a spelling instead of
// each holding its own copy — which `src/middleware.ts`'s own header asks
// for in as many words: "until BP-061 ships and sets it — at which point
// the two must agree".
//
// Every name here is an internal one (constitution rule 1.1): a cookie's
// wire name, a route, a query marker. None is a sentence anybody reads, so
// none is a copy key.

/** The session cookie. Its *presence* is all `src/middleware.ts` checks;
 *  its contents are verified by `currentSession()` and by nothing else. */
export const SESSION_COOKIE_NAME = "rk_session";

/** The screen anyone without a session meets (REQ-098 criterion 1). */
export const SIGNIN_PATH = "/signin";

/** One dynamic segment beneath it: the route that redeems a link.
 *  `src/middleware.ts`'s `PUBLIC_PATHS` carries this pattern because
 *  redeeming is unauthenticated by necessity — the whole point of the link
 *  is that its holder has no session yet. */
export const SIGNIN_LINK_PATH_PATTERN = "/signin/:token";

/** The query marker the sign-in screen reads to speak `signin.link_dead`.
 *  REQ-098 criterion 7: expired, spent and never-issued are one case with
 *  one line and one shape, "so someone holding a link that is not theirs
 *  learns nothing about whether the address it was issued for has an
 *  account" — so this marker names no reason, and there is only one of it. */
export const DEAD_LINK_MARKER = "dead";

/** The query key that marker rides on. */
export const LINK_QUERY_KEY = "link";

/** Where a sign-in link points, as a path. The origin is
 *  `NEXT_PUBLIC_APP_URL`'s and is added by the issuer, which is the one
 *  place that reads `env`. */
export function signInLinkPath(token: string): string {
  return `${SIGNIN_PATH}/${encodeURIComponent(token)}`;
}

/** Where a link that no longer works lands its holder (REQ-098 c7). */
export function deadLinkPath(): string {
  return `${SIGNIN_PATH}?${LINK_QUERY_KEY}=${DEAD_LINK_MARKER}`;
}
