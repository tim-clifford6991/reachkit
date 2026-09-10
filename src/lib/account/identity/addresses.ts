// src/lib/account/identity/addresses.ts — BUILD §13
//
// The names identity and the surfaces around it must agree on: which
// cookies are a Supabase Auth session, where a sign-in link points, and the
// marker that puts REQ-098 criterion 7's line on the sign-in screen.
//
// **This module imports nothing, and that is load-bearing.**
// `src/middleware.ts` reads the session cookie's name on every request and
// asks the network only when one is present; every other file in this
// directory pulls `env`, `@supabase/ssr` and `@/lib/db`. A leaf with no
// imports is what lets the one allow-list and the one issuer share a
// spelling instead of each holding its own copy.
//
// Every name here is an internal one (constitution rule 1.1): a cookie's
// wire name, a route, a query marker. None is a sentence anybody reads, so
// none is a copy key.

/** Supabase Auth's session cookie (#468): `sb-{ref}-auth-token`, split into
 *  `.0`, `.1`, … chunks when it outgrows one cookie. The `{ref}` is the
 *  first label of `SUPABASE_URL`'s host, which is `@supabase/ssr`'s rule and
 *  not this product's, so it is matched rather than spelled. Its presence
 *  is all `src/middleware.ts` checks before it asks Supabase who it is. */
const AUTH_COOKIE = /^sb-[^.]+-auth-token(\.\d+)?$/;

export function isAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name);
}

/** The screen anyone without a session meets (REQ-098 criterion 1). */
export const SIGNIN_PATH = "/signin";

/** The route that redeems a link (#468): Supabase's `token_hash` and the
 *  verification type ride in the query, on this product's own host. Public
 *  by necessity — the whole point of the link is that its holder has no
 *  session yet. */
export const CONFIRM_PATH = "/auth/confirm";

/** The two verification types a link of ours is ever issued as. */
export type ConfirmType = "magiclink" | "email_change";

/** The query keys the confirm route reads. Supabase's own spelling, so a
 *  link is the shape its documentation describes. */
export const TOKEN_HASH_QUERY_KEY = "token_hash";
export const TYPE_QUERY_KEY = "type";

/** The query marker the sign-in screen reads to speak `signin.link_dead`.
 *  REQ-098 criterion 7: expired, spent and never-issued are one case with
 *  one line and one shape, "so someone holding a link that is not theirs
 *  learns nothing about whether the address it was issued for has an
 *  account" — so this marker names no reason, and there is only one of it. */
export const DEAD_LINK_MARKER = "dead";

/** The query key that marker rides on. */
export const LINK_QUERY_KEY = "link";

/** Where a link points, as a path and query. The origin is
 *  `NEXT_PUBLIC_APP_URL`'s and is added by the issuer, which is the one
 *  place that reads `env`. */
export function confirmLinkPath(tokenHash: string, type: ConfirmType): string {
  const query = new URLSearchParams({ [TOKEN_HASH_QUERY_KEY]: tokenHash, [TYPE_QUERY_KEY]: type });
  return `${CONFIRM_PATH}?${query.toString()}`;
}

/** Where a link that no longer works lands its holder (REQ-098 c7). */
export function deadLinkPath(): string {
  return `${SIGNIN_PATH}?${LINK_QUERY_KEY}=${DEAD_LINK_MARKER}`;
}
