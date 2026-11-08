// src/lib/db/rest.ts — `dbAdmin()`'s PostgREST half alone, so a cold request that only reads a table loads no
// auth, realtime, storage or functions module. The key is sent the way supabase-js sends it.
import { PostgrestClient } from "@supabase/postgrest-js";
import { env } from "@/lib/config/env";
import type { Database } from "./types.generated";

let restClient: PostgrestClient<Database> | undefined;

/** Server-only, bypasses RLS: a module singleton, like `dbAdmin()`. */
export function dbAdminRest(): PostgrestClient<Database> {
  if (typeof window !== "undefined") {
    throw new Error("src/lib/db/rest.ts: dbAdminRest() is server-only and cannot be evaluated in a client bundle.");
  }
  if (!restClient) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const base = new URL(env.SUPABASE_URL.trim().replace(/\/?$/, "/"));
    restClient = new PostgrestClient<Database>(new URL("rest/v1", base).href, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  }
  return restClient;
}
