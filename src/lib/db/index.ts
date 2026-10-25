// src/lib/db/index.ts — the only two ways to reach Postgres
//
// BP-002 `## Public interface` (verbatim):
//   export function db(): SupabaseClient<Database>        // request-scoped, RLS applies
//   export function dbAdmin(): SupabaseClient<Database>   // server-only, bypasses RLS
//                                                         // throws if imported in a client bundle
//   export type { Database } from './types.generated'
//
// BP-002 `## NFR budget`: "Connection use: the request-scoped client per
// request, the admin client as a module singleton in server code only."
// `db()` therefore constructs a fresh client on every call; `dbAdmin()`
// memoises one.
//
// BP-002 `## Error & edge behavior`: "A `dbAdmin()` import from a client
// component is a build error, not a runtime one." The `server-only` npm
// package — Next's canonical mechanism for this — is not present in this
// repository's dependency tree (`package.json` is not in this work order's
// file plan, and installing a package here would touch it — a deviation
// this work order's return states plainly), so the build-time half is the
// eslint rule `local/no-db-admin-in-client` in `eslint.config.mjs`. The
// runtime half — `typeof window`, below — is
// the separate, independent guard on `dbAdmin()` itself.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/config/env";
import type { Database } from "./types.generated";

export type { Database } from "./types.generated";

/**
 * Request-scoped: RLS applies through the anon key. A fresh client per
 * call — BP-002 `## NFR budget`, "the request-scoped client per request".
 */
export function db(): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let adminClient: SupabaseClient<Database> | undefined;

/**
 * Server-only: bypasses RLS through the service-role key. A module
 * singleton — BP-002 `## NFR budget`, "the admin client as a module
 * singleton in server code only". Throws if evaluated where `window`
 * exists (BP-002 `## Error & edge behavior`; the runtime half of the guard
 * — see the module header for the build-time half).
 */
export function dbAdmin(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error(
      "src/lib/db/index.ts: dbAdmin() is server-only and cannot be evaluated in a client bundle."
    );
  }
  if (!adminClient) {
    adminClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
