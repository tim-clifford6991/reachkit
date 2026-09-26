// SPEC §1, owner 2026-09-26 (#1125) — where the public header's one button
// into the app goes, for a reader who is signed in.
// src/app/(public)/_chrome/session.ts
//
// Signed in, the header trades *Sign in* and *Start free* for one solid
// button into the app. It goes where `/app`'s own session seam
// (`(account)/app/_session/account.ts`) would send the same session: an
// account with no site yet is still in setup and goes to `/setup`, every
// other one to `/app`, whose gates take it from there.
//
// **Never the reason a public page fails.** No auth cookie is answered
// without a read, so a stranger costs nothing; any failure past that — an
// unset binding, Supabase down, a render outside a request — is the
// signed-out header.
import { cookies } from "next/headers";
import { isAuthCookieName } from "@/lib/account/identity/addresses";

/** Where the header's button into the app goes, or `null` for the
 *  signed-out header. */
export type AppEntry = "/app" | "/setup" | null;

export async function appEntry(): Promise<AppEntry> {
  // Outside the `try`: reading the cookies is what tells Next this render
  // is per request, and that signal must not be swallowed.
  const jar = await cookies();
  if (!jar.getAll().some((cookie) => isAuthCookieName(cookie.name))) return null;
  try {
    // Imported at the call: `currentSession` reaches `@/lib/db`, which
    // parses every binding the moment it is evaluated (the reason
    // `_session/account.ts` defers the same import).
    const { currentSession } = await import("@/lib/account/identity");
    const session = await currentSession();
    if (session === null) return null;
    return session.siteId === null ? "/setup" : "/app";
  } catch {
    return null;
  }
}
