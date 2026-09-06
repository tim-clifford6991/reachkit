// src/lib/account/session.ts — BUILD §13
//
// Who is making this request, and which site is theirs.
//
// The token half of magic-link identity — `auth_links`, `issueLink`,
// `redeemLink` and the cookie the session is read from — is issue #35's,
// under its own migration sub-token. This module is the **port** every
// route reads the session through, so a route never reaches for a cookie
// itself and #35 lands behind one registration rather than at every call
// site.
//
// **It fails closed.** With nothing registered, `currentSession()` answers
// `null`, which every caller must treat as "not signed in". It invents no
// user and no site: a route that acted on a guessed site id would act on
// someone else's pages, which is the one failure this port exists to
// prevent.
//
// The same registration door `registerSignInLinkIssuer` and
// `registerSuppressionReader` use, for the same reason: a `src/lib` module
// cannot import the module that will own the thing, and a fake is worse
// than an honest refusal.

export interface Session {
  userId: string;
  /** The site this person's account owns. Every ownership check in the
   *  product is against this value. */
  siteId: string;
}

export type SessionReader = () => Promise<Session | null>;

const notWiredYet: SessionReader = async () => null;

let reader: SessionReader = notWiredYet;

/** Wired by the module that owns `auth_links` (issue #35); `null` restores
 *  the fail-closed default. */
export function registerSessionReader(next: SessionReader | null): void {
  reader = next ?? notWiredYet;
}

export async function currentSession(): Promise<Session | null> {
  return reader();
}
