import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db/client";

// SSE stream of scan_events for a scan. The Inngest pipeline persists every
// progress event server-side (lib/scan/progress.ts → scan_events), so this route
// is a thin *tail* over the DB: replay everything after a cursor, then poll for
// new rows until a terminal event (`done`/`error`) or the duration bound.
//
// Resilience contract (paired with app/(funnel)/scan/[id]/scan-stream.tsx):
//   - Every SSE message carries `id: <bigint>` (the scan_events row id) so the
//     client can resume after a drop via `?since=` (or the native Last-Event-ID
//     header on automatic reconnect) — no duplicates, no missed events.
//   - Heartbeat comments (`: ping`) keep the connection alive through proxies.
//   - The loop runs up to ~290s. A real scan with live APIs takes minutes; the
//     old 30s cap closed the stream BEFORE `done` was emitted, which surfaced as
//     a phantom "this scan didn't finish" even on perfectly healthy scans.
//
// No "force-dynamic" export: it conflicts with cacheComponents in next.config.ts.
// The streaming body + no-cache headers make this route dynamic on their own.
export const maxDuration = 300;

const POLL_MS = 250;
const HEARTBEAT_EVERY = 40; // ~10s of idle (40 * 250ms) between heartbeats
const MAX_MS = 290_000; // stay under maxDuration; covers multi-minute live scans

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Resume cursor: explicit ?since= wins, else the native Last-Event-ID header.
  const sinceParam = Number(req.nextUrl.searchParams.get("since"));
  const headerId = Number(req.headers.get("last-event-id"));
  let lastId = Math.max(
    Number.isFinite(sinceParam) ? sinceParam : 0,
    Number.isFinite(headerId) ? headerId : 0,
  );

  const db = serverDb();
  const started = Date.now();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const enqueue = (s: string) => {
        if (cancelled) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          cancelled = true; // controller closed (client went away)
        }
      };
      const sendRow = (row: { id: number; type: string; payload: unknown }) =>
        enqueue(
          `id: ${row.id}\ndata: ${JSON.stringify({ type: row.type, payload: row.payload })}\n\n`,
        );

      let idle = 0;
      let terminal = false;
      while (!cancelled && !terminal && Date.now() - started < MAX_MS) {
        const { data, error } = await db
          .from("scan_events")
          .select("id, type, payload")
          .eq("scan_id", id)
          .gt("id", lastId)
          .order("id");

        if (error) {
          enqueue(
            `data: ${JSON.stringify({ type: "error", payload: { message: "stream read failed" } })}\n\n`,
          );
          break;
        }

        if (data && data.length > 0) {
          idle = 0;
          for (const row of data) {
            lastId = row.id as number;
            sendRow(row as { id: number; type: string; payload: unknown });
            if (row.type === "done" || row.type === "error") {
              terminal = true;
              break;
            }
          }
        } else if (++idle % HEARTBEAT_EVERY === 0) {
          enqueue(`: ping\n\n`);
        }

        if (terminal || cancelled) break;
        await new Promise((r) => setTimeout(r, POLL_MS));
      }

      try {
        controller.close();
      } catch {
        /* already closed */
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering so events flush live
    },
  });
}
