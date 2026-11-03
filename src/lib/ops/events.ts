// A failed Settings read, kept as a row: the runtime log holds it for under an hour, so the daily check counts these.
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = (async () => {
    const { dbAdmin } = await import("@/lib/db");
    const insert = (dbAdmin() as unknown as InsertOnly)
      .from("ops_events")
      .insert({ kind: "settings_read_failed", read, site_id: siteId, code: failureCode(error) });
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
