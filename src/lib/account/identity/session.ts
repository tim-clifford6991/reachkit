// src/lib/account/identity/session.ts — BUILD §13
//
// Reading the session on an authenticated request, and ending one.
//
// **The session is Supabase Auth's** (#468). Its cookie is written by
// `@supabase/ssr` on a redemption (`/auth/confirm`) and refreshed by the
// middleware; this module never mints, signs or parses one. Who is asking
// is `getUser()`'s answer — Supabase verifying the token, not this process
// believing a cookie.
//
// **`signOut` ends this session only** (REQ-077 criterion 5, and BP-061's
// note on it: "Other devices keep their sessions; REQ-077 states no global
// sign-out and none is invented").
//
// **`signOutEverywhere` is for a deleted account**, which ends every
// session the account holds, the asking one included:
// `auth.admin.signOut(token, "global")`. The other exception — a completed
// email change — uses `others` from the redemption itself
// (`email-change-complete.ts`).
import { cookies } from "next/headers";
import { identityAuth, type CookieIO } from "./auth";
import { identityStore } from "./store";

export interface Session {
  readonly userId: string;
  /** The account's one site. `null` where no site row exists yet — §13
   *  opens an account before setup names a domain, so a session can
   *  legitimately precede a site, and inventing an id here would be a
   *  worse answer than saying so. */
  readonly siteId: string | null;
}

/**
 * This request's cookie jar as the session client reads and writes it.
 * A write from a Server Component throws (only a Server Function or a
 * Route Handler may set a cookie); that is caught, because the middleware
 * already wrote the refreshed session onto the response carrying this
 * render.
 */
export async function requestCookieIO(): Promise<CookieIO> {
  const jar = await cookies();
  return {
    getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const cookie of list) {
        try {
          jar.set(cookie.name, cookie.value, cookie.options);
        } catch {
          // A Server Component render — see above.
        }
      }
    },
  };
}

/**
 * Who is making this request, or `null`. Total: no session, a session
 * Supabase does not recognise, one it has revoked, one belonging to a
 * tombstoned account and one whose account row cannot be read are all
 * `null`, and none of them says which.
 */
export async function currentSession(): Promise<Session | null> {
  const user = await identityAuth().sessionUser(await requestCookieIO());
  if (user === null) return null;

  const store = identityStore();
  const read = await store.account(user.userId);
  // A store that cannot be read is not a session. Failing closed here costs
  // a customer one redirect to the sign-in screen; failing open would serve
  // an account's own pages on a claim nothing checked.
  if (!read.ok || read.account === null) return null;
  if (read.account.deleted_at !== null) return null;

  const site = await store.siteForAccount(user.userId);
  if (!site.ok) return null;

  return { userId: user.userId, siteId: site.siteId };
}

/** REQ-077 criterion 5. Ends this session only. */
export async function signOut(): Promise<void> {
  await identityAuth().endSession(await requestCookieIO());
}

/**
 * Ends every session the asking account holds — this one included — with
 * `auth.admin.signOut(token, "global")`. Refuses unless the request's own
 * session is `userId`'s, so no caller can end an account it is not signed
 * in as.
 */
export async function signOutEverywhere(userId: string): Promise<{ ok: boolean }> {
  const auth = identityAuth();
  const user = await auth.sessionUser(await requestCookieIO());
  if (user === null || user.userId !== userId) return { ok: false };
  return auth.signOutEverywhere(user.accessToken, "global");
}
