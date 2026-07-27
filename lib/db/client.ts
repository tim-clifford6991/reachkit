import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { env } from "@/lib/config/env";

// Service-role client for pipeline/server code (bypasses RLS by design — all MVP writes go through here).
export const serverDb = () =>
  createClient<Database>(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false },
  });

/** The service-role client type — for helpers that take a `db` handle. */
export type ServerDb = ReturnType<typeof serverDb>;
