// src/lib/db/rest.ts — `dbAdmin()`'s PostgREST half alone, so a cold request that only reads a table loads no
// auth, realtime, storage or functions module. The key is sent the way supabase-js sends it.
import { AsyncLocalStorage } from "node:async_hooks";
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

type Gate = <R>(send: () => Promise<R>) => Promise<R>;
const lane = new AsyncLocalStorage<Gate>();

/** Runs `work` with at most `limit` of its admin database requests in flight, so a long job leaves the database API's
 *  small connection pool to people. Work already in a lane keeps that lane. */
export function withDbLane<T>(limit: number, work: () => Promise<T>): Promise<T> {
  if (lane.getStore() !== undefined) return work();
  let busy = 0;
  const waiting: (() => void)[] = [];
  const gate: Gate = async (send) => {
    while (busy >= limit) await new Promise<void>((go) => waiting.push(go));
    busy += 1;
    try {
      return await send();
    } finally {
      busy -= 1;
      waiting.shift()?.();
    }
  };
  return lane.run(gate, work);
}

/** The admin clients' fetch: `base`, or the global one, through the lane of the work that calls it. */
export function lanedFetch(base?: typeof fetch): typeof fetch {
  return (input, init) => {
    const send = () => (base ?? fetch)(input, init);
    const gate = lane.getStore();
    return gate === undefined ? send() : gate(send);
  };
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
      fetch: lanedFetch(buildReadOptions()?.fetch),
    });
  }
  return restClient;
}
