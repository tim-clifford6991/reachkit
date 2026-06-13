import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/config/env";
import type { Database } from "@/lib/db/types";

export function createBrowserSupabase() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
