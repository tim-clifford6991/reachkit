import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";

/**
 * Refresh the Supabase auth session on every request — the one place that CAN
 * persist rotated cookies.
 *
 * Without this, `getUser()` inside Server Components triggers the token refresh,
 * but Server Components are read-only for cookies (see createServerSupabase in
 * ./server.ts — its `setAll` throws and is swallowed). The *rotated* refresh
 * token then never reaches the browser, so once the ~1h access token expires the
 * next navigation races several concurrent RSC refreshes against a stale token →
 * `AuthApiError: refresh_token_not_found` bubbles up uncaught → the app error
 * boundary ("We hit an unexpected error"). A hard reload only "worked" by landing
 * inside Supabase's refresh-token reuse grace window.
 *
 * Here we refresh once, up front, and write the fresh cookies onto BOTH the
 * forwarded request (so downstream Server Components read a valid access token
 * and never re-refresh) and the response (so the browser stores the rotation).
 *
 * Canonical @supabase/ssr Next.js pattern — do not insert logic between
 * createServerClient and getUser().
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  // FAIL-OPEN, whole body: middleware runs on EVERY page, so any throw here
  // (env parse included — prod logs showed zod failing on missing SUPABASE_*
  // in deployments without the env targeted, 500ing every matched page) must
  // degrade to "proceed unauthenticated", never take the site down. The app's
  // own auth gates (currentUser → /login redirect) handle the rest.
  try {
    const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refresh the session. A dead/absent session is not an error here.
    await supabase.auth.getUser();
  } catch (e) {
    console.error("[middleware] session refresh skipped (fail-open)", e instanceof Error ? e.message : e);
  }

  return supabaseResponse;
}
