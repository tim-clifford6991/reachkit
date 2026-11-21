// src/lib/db/rest.ts — `dbAdmin()`'s PostgREST half alone, so a cold request that only reads a table loads no
// auth, realtime, storage or functions module. The key is sent the way supabase-js sends it.
import { PostgrestClient } from "@supabase/postgrest-js";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { env } from "@/lib/config/env";
import { fetchWithin } from "@/lib/egress/deadline";
import type { Database } from "./types.generated";

/** How long one database request may take while `next build` prerenders. */
export const BUILD_READ_DEADLINE_MS = 3000;

/** A down database at build must not outlast static generation's 60 s: one try, cut short, returned as the `error`. */
export function buildReadOptions(): { fetch: typeof fetch; retry: false } | undefined {
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) return undefined;
  return { retry: false, fetch: fetchWithin(BUILD_READ_DEADLINE_MS) };
}

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
      ...buildReadOptions(),
    });
  }
  return restClient;
}
