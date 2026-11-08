// Ops events kept as rows: the runtime log holds them for under an hour, so the daily check counts these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

/** A write past this is abandoned, so a slow database never holds the response open longer. */
const WRITE_DEADLINE_MS = 1_500;

/** A short class for the failure, never its message: `timeout`, or the error's name. */
export function failureCode(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("settings read timed out")) return "timeout";
  return (error instanceof Error ? error.name : typeof error).slice(0, 40);
}

interface InsertOnly {
  from(table: string): { insert(row: object): PromiseLike<{ error: { message: string } | null }> };
}

/** Starts the write and returns at once; the promise never rejects, and a failed write is only logged. */
export function recordSettingsReadFailed(read: string, error: unknown, siteId: string | null = null): Promise<void> {
  return recordOpsEvent("settings_read_failed", read, failureCode(error), siteId);
}

/** One `ops_events` row, written the same way: started at once, never rejecting, a failure only logged. */
export function recordOpsEvent(kind: string, read: string, code: string, siteId: string | null = null): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = (async () => {
    const { dbAdmin } = await import("@/lib/db");
    const insert = (dbAdmin() as unknown as InsertOnly).from("ops_events").insert({ kind, read, site_id: siteId, code });
    const { error: failed } = await Promise.race([
      insert,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("ops event write timed out")), WRITE_DEADLINE_MS);
      }),
    ]);
    if (failed !== null) throw new Error(failed.message);
  })()
    .catch((failure: unknown) => {
      console.warn(JSON.stringify({ event: "ops_event_write_failed", read, detail: String(failure) }));
    })
    .finally(() => clearTimeout(timer));
  try {
    // Keeps a serverless invocation alive until the write settles.
    after(write);
  } catch {
    // Outside a request scope there is nothing to keep alive; the write is already running.
  }
  return write;
}

/** Writes a `kind` row for the site where none is held with `code` as its key, awaited because the row gates its
 *  caller; `false` where one already was. */
export async function claimOpsEvent(kind: string, siteId: string, code: string, read: string): Promise<boolean> {
  const { dbAdmin } = await import("@/lib/db");
  const events = () => (dbAdmin() as unknown as SupabaseClient).from("ops_events");
  const prior = await events().select("id").eq("kind", kind).eq("site_id", siteId).eq("code", code).limit(1);
  if (prior.error !== null) throw new Error(`ops_events claim: ${prior.error.message}`);
  if (prior.data.length > 0) return false;
  const { error } = await events().insert({ kind, read, site_id: siteId, code });
  if (error !== null) throw new Error(`ops_events claim: ${error.message}`);
  return true;
}
