import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";

type UsersRow = Database["public"]["Tables"]["users"]["Row"];

export class AuthError extends Error {
  constructor(message = "authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        // In Server Components setAll throws (read-only) — swallow;
        // middleware/route handlers refresh cookies.
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* RSC read-only */
        }
      },
    },
  });
}

export async function currentUser(): Promise<{ authId: string; user: UsersRow } | null> {
  const supa = await createServerSupabase();
  // On an expired session, supabase-js may *reject* here (not just resolve with
  // { error }) — e.g. AuthApiError(refresh_token_not_found) when a token refresh
  // fails. In a Server Component we can't persist rotated cookies (see
  // createServerSupabase.setAll), so a failed refresh must degrade to
  // "unauthenticated" and let callers redirect to /login — never surface as an
  // uncaught error. The middleware (middleware.ts) refreshes sessions in the one
  // place that CAN write cookies, so this path should be rare.
  const user = await supa.auth
    .getUser()
    .then(({ data, error }) => (error ? null : data.user))
    .catch(() => null);
  if (!user) return null;
  // Load the profile row (service-role read keeps this simple + server-only)
  const { data: row } = await serverDb()
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!row) return null;
  return { authId: user.id, user: row };
}

export async function requireUser(): Promise<{ authId: string; user: UsersRow }> {
  const u = await currentUser();
  if (!u) throw new AuthError();
  return u;
}
