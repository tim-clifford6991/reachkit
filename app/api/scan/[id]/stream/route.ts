import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db/client";

// No "force-dynamic" export: route handlers are not cached by default; adding it
// conflicts with cacheComponents:true in next.config.ts. The SSE headers below
// (Cache-Control: no-cache) are sufficient to prevent any intermediary caching.
// The streaming response body makes this route dynamic automatically.

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serverDb();
  let lastId = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      for (let i = 0; i < 120; i++) {                       // <=30s at 250ms
        const { data } = await db
          .from("scan_events")
          .select("id, type, payload")
          .eq("scan_id", id)
          .gt("id", lastId)
          .order("id");
        for (const row of data ?? []) {
          lastId = row.id;
          send({ type: row.type, payload: row.payload });
          if (row.type === "done" || row.type === "error") {
            controller.close();
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
