// src/lib/scan/fetch-facts.ts — the re-score's facts of stored reads, kept in
// `fetch_facts` at one facts version: read for the ids asked, and for a read
// with none at that version, its payload downloaded once, its facts derived
// (`page-facts.ts`) and kept. Every id is asked for once per run.
import { offline } from "@/lib/egress/offline";
import { onceById } from "./own-reads";
import { pageFactsOf, type PageFacts } from "./page-facts";

/** `fetches`, `fetch_facts` and the re-score's functions are not in the
 *  generated `Database` type — the same narrow cast `src/jobs/heartbeat.ts` documents. */
export interface MinimalResult<T> {
  data: T | null;
  error: { message: string } | null;
}
export interface MinimalQuery<T> extends PromiseLike<MinimalResult<T[]>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  insert(values: Record<string, unknown>): MinimalQuery<T>;
  upsert(values: readonly Record<string, unknown>[], options: { onConflict: string }): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean }): MinimalQuery<T>;
  range(from: number, to: number): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
export interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
  rpc<T>(fn: string, args: Record<string, unknown>): PromiseLike<MinimalResult<T>>;
}

export function checked<T>(result: MinimalResult<T>): T {
  if (result.error !== null) throw new Error(result.error.message);
  return result.data as T;
}

// Ids per `in` filter, so a long read history never outgrows a request's address.
const IDS = 100;

/** The loader one run shares. `version` null keeps nothing: every read's
 *  facts come from its payload. `got` counts what a request downloaded,
 *  `refresh` set where it was payloads. */
export function factsLoader(client: () => Promise<MinimalClient>, version: string | null, got: <T>(result: MinimalResult<T>, refresh?: boolean) => T) {
  const batch = async (ids: readonly string[]): Promise<Map<string, PageFacts>> => {
    const db = await client();
    const out = new Map<string, PageFacts>();
    if (version !== null) {
      const kept = got(await db.from<{ fetch_id: string; facts: PageFacts }>("fetch_facts").select("fetch_id, facts").eq("facts_version", version).in("fetch_id", ids));
      for (const row of kept ?? []) out.set(row.fetch_id, row.facts);
    }
    const missing = ids.filter((id) => !out.has(id));
    if (missing.length === 0) return out;
    const rows = got(await db.from<{ id: string; cache_key: string; payload: unknown }>("fetches").select("id, cache_key, payload").in("id", missing), true) ?? [];
    const at = new Date().toISOString();
    const derived = offline("scan/rescore", "A page's facts are read from its stored payload.", () =>
      rows.map((r) => ({ fetch_id: r.id, facts_version: version, facts: pageFactsOf(r.cache_key, r.payload), computed_at: at }))
    );
    for (const row of derived) out.set(row.fetch_id, row.facts);
    if (version !== null && derived.length > 0) checked(await db.from("fetch_facts").upsert(derived, { onConflict: "fetch_id" }));
    return out;
  };
  return onceById<PageFacts>(async (all) => {
    const out = new Map<string, PageFacts>();
    for (let i = 0; i < all.length; i += IDS) for (const [id, facts] of await batch(all.slice(i, i + IDS))) out.set(id, facts);
    return out;
  });
}
