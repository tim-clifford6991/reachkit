// src/lib/account/identity/request-session.ts — BUILD §13 (#468)
//
// The middleware's one question — is anybody signed in on this request? —
// answered by Supabase rather than by a cookie's presence.
//
// **`getUser()`, never `getSession()` alone.** The first sends the token to
// Supabase and gets back the user it belongs to; the second decodes a
// cookie the browser could have written itself. The middleware's answer is
// the last word for every `(account)` route that never calls
// `currentSession()`, so it must be the one that cannot be forged.
//
// **The refresh rides back out.** A session near its expiry is refreshed
// here — `@supabase/ssr` asks for it in the middleware for exactly this
// reason, because a Server Component cannot set a cookie — and the new
// cookies are returned so `src/middleware.ts` can put them both on the
// request the render reads and on the response the browser keeps.
import type { NextRequest } from "next/server";
import { isAuthCookieName } from "./addresses";
import { identityAuth, type CookieToSet } from "./auth";

export async function requestUser(
  req: NextRequest
): Promise<{ userId: string | null; refreshed: CookieToSet[] }> {
  const refreshed: CookieToSet[] = [];
  if (!req.cookies.getAll().some((c) => isAuthCookieName(c.name))) {
    return { userId: null, refreshed };
  }
  const user = await identityAuth().sessionUser({
    getAll: () => req.cookies.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (list) => {
      for (const cookie of list) {
        req.cookies.set(cookie.name, cookie.value);
        refreshed.push(cookie);
      }
    },
  });
  return { userId: user?.userId ?? null, refreshed };
}
