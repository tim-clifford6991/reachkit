// src/lib/account/identity/session.ts — BUILD §13
//
// Reading the session on an authenticated request, starting one on a
// redemption, and ending one on sign-out.
//
// **`signOut` ends this session only** (REQ-077 criterion 5, and BP-061's
// note on it: "Other devices keep their sessions; REQ-077 states no global
// sign-out and none is invented"). Deleting the cookie is the whole of it —
// the browser that pressed the control has no session, and no other browser
// is touched.
//
// **The one exception is a completed email change** (BP-061 decision 4),
// which does end every other session. That is not a second mechanism: the
// cookie carries the moment it was issued, `users.sessions_valid_from`
// carries the moment every earlier session ended, and the comparison below
// is where they meet. One column, one comparison, and no list of devices
// anywhere.
//
// **One indexed read** (BP-061's NFR budget: `currentSession` p95 ≤ 5 ms,
// "Cookie-verified, one indexed read at most"). The signature and the
// expiry are checked with no database at all; the read that follows is the
// `users` row by primary key, and it is what makes the change stamp and the
// tombstone effective. The site id rides in the signed cookie so it costs
// no second read — an account whose site row did not exist when the session
// began carries `null`, which is the truth rather than a fabricated id.
import { cookies } from "next/headers";
import { env } from "@/lib/config/env";
import { SESSION_COOKIE_NAME } from "./addresses";
import { mintSessionCookie, readSessionCookie, SESSION_MAX_AGE_SECONDS } from "./cookie";
import { identityStore } from "./store";

export interface Session {
  readonly userId: string;
  /** The account's one site. `null` where no site row exists yet — §13
   *  opens an account before setup names a domain, so a session can
   *  legitimately precede a site, and inventing an id here would be a
   *  worse answer than saying so. */
  readonly siteId: string | null;
}

/** `secure` follows the deployment's own origin rather than `NODE_ENV`: a
 *  preview on https gets a secure cookie, and a local http dev server gets
 *  a cookie a browser will actually store. */
function cookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    // `lax`, not `strict`: the sign-in link arrives from a mail client, and
    // a `strict` cookie set on that navigation would not be sent on the
    // redirect that follows it — the customer would sign in and land
    // signed out.
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * The session cookie to set, as a value rather than an act. Returned this
 * way because the one caller — the redemption route — answers with a
 * redirect, and a cookie belongs on the response that carries it:
 * "Alternatively, you can return a new `Response` using the `Set-Cookie`
 * header" (`next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * route.md`). A pure descriptor is also what lets the suite assert what
 * gets set without a request.
 */
export function sessionCookie(a: {
  userId: string;
  siteId: string | null;
  issuedAt: Date;
}): { name: string; value: string; options: ReturnType<typeof cookieOptions> } {
  return {
    name: SESSION_COOKIE_NAME,
    value: mintSessionCookie(a),
    options: cookieOptions(),
  };
}

/**
 * Who is making this request, or `null`. Total: an absent cookie, a
 * malformed one, a forged one, one past its window, one issued before the
 * account's sessions were ended, and one belonging to a tombstoned account
 * are all `null`, and none of them says which.
 */
export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (raw === undefined || raw.length === 0) return null;

  const claims = readSessionCookie(raw, new Date());
  if (claims === null) return null;

  const read = await identityStore().account(claims.userId);
  // A store that cannot be read is not a session. Failing closed here costs
  // a customer one redirect to the sign-in screen; failing open would serve
  // an account's own pages on a claim nothing checked.
  if (!read.ok || read.account === null) return null;
  if (read.account.deleted_at !== null) return null;

  const endedAt = read.account.sessions_valid_from;
  if (endedAt !== null && claims.issuedAt.getTime() < new Date(endedAt).getTime()) return null;

  return { userId: claims.userId, siteId: claims.siteId };
}

/** REQ-077 criterion 5. Ends this session only. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}
