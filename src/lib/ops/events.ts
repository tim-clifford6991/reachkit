// Ops events kept as rows: the runtime log holds them for under an hour, so the daily check counts these.
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { cache } from "react";

/** A write past this is abandoned, so a slow database never holds the response open longer. */
const WRITE_DEADLINE_MS = 1_500;

/** A short class for the failure, never its message: `timeout`, or the error's name. */
export function failureCode(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("settings read timed out")) return "timeout";
  return (error instanceof Error ? error.name : typeof error).slice(0, 40);
}

/** Whether a Settings read has answered in this process; module state, so a fresh instance or route chunk starts cold. */
let warm = false;

/** A read's deadline: `warmMs` once one has answered here, four times it before that, because a cold process's first
 *  screen shares its event loop with module loads and opens its database connections while the timers run. */
export function readDeadlineMs(warmMs: number): number {
  return warm ? warmMs : warmMs * 4;
}

/** Marks the process warm: a read answered inside its deadline. */
export function readAnswered(): void {
  warm = true;
}

interface InsertOnly {
  from(table: string): { insert(row: object): PromiseLike<{ error: { message: string } | null }> };
}

/** The reads one request saw fail; `cache` scopes it to the request, and outside one each call stands alone. */
const failedThisRequest = cache((): { reads: string[] } => ({ reads: [] }));

/** One row per request, naming every read that failed in it, written once the response is sent; outside a request
 *  scope it is written at once. Never rejects, and a failed write is only logged. */
export function recordSettingsReadFailed(read: string, error: unknown, siteId: string | null = null): Promise<void> {
  const failed = failedThisRequest();
  failed.reads.push(read);
  if (failed.reads.length > 1) return Promise.resolve();
  const write = () => recordOpsEvent("settings_read_failed", failed.reads.join(","), failureCode(error), siteId);
  try {
    after(write);
    return Promise.resolve();
  } catch {
    return write();
  }
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

// Returns a factory: a query builder can be thenable, so an async function returning one would run it.
const events = async () => {
  const { dbAdmin } = await import("@/lib/db");
  return () => (dbAdmin() as unknown as SupabaseClient).from("ops_events");
};

/** Whether a `kind` row is held for the site with `code` as its key. */
export async function opsEventHeld(kind: string, siteId: string, code: string): Promise<boolean> {
  const prior = await (await events())().select("id").eq("kind", kind).eq("site_id", siteId).eq("code", code).limit(1);
  if (prior.error !== null) throw new Error(`ops_events claim: ${prior.error.message}`);
  return prior.data.length > 0;
}

/** The `read` of the site's `kind` row keyed `code`, or `null` where none is held. */
export async function opsEventRead(kind: string, siteId: string, code: string): Promise<string | null> {
  const held = await (await events())().select("read").eq("kind", kind).eq("site_id", siteId).eq("code", code).limit(1);
  if (held.error !== null) throw new Error(`ops_events read: ${held.error.message}`);
  return (held.data[0] as { read: string } | undefined)?.read ?? null;
}

/** Writes a `kind` row for the site where none is held with `code` as its key, awaited because the row gates its
 *  caller; `false` where one already was. */
export async function claimOpsEvent(kind: string, siteId: string, code: string, read: string): Promise<boolean> {
  if (await opsEventHeld(kind, siteId, code)) return false;
  const { error } = await (await events())().insert({ kind, read, site_id: siteId, code });
  if (error !== null) throw new Error(`ops_events claim: ${error.message}`);
  return true;
}

/** Writes the site's `kind` row keyed `code`, then drops the ones held before it, so the one read is this. */
export async function replaceOpsEvent(kind: string, siteId: string, code: string, read: string): Promise<void> {
  const rows = await events();
  const { data, error } = await rows().insert({ kind, read, site_id: siteId, code }).select("id").single();
  if (error !== null) throw new Error(`ops_events replace: ${error.message}`);
  const dropped = await rows().delete().eq("kind", kind).eq("site_id", siteId).eq("code", code).lt("id", (data as { id: number }).id);
  if (dropped.error !== null) throw new Error(`ops_events replace: ${dropped.error.message}`);
}

/** A page written anyway after its day's pack fell short, `reason` what it fell short of: one row per draft however often
 *  its day's job runs. Never throws, since the page it reports on stands. */
export function recordWrittenAnyway(siteId: string, draftId: string, reason: string): Promise<boolean> {
  return claimOpsEvent("page_written_anyway", siteId, draftId, reason).catch(() => false);
}

/** The `code` of the newest `kind` row whose `read` is this, or `null` where there is none. */
export async function latestOpsEventCode(kind: string, read: string): Promise<string | null> {
  const latest = await (await events())().select("code").eq("kind", kind).eq("read", read).order("id", { ascending: false }).limit(1);
  if (latest.error !== null) throw new Error(`ops_events read: ${latest.error.message}`);
  return (latest.data[0] as { code: string } | undefined)?.code ?? null;
}
