import { NextRequest } from "next/server";

// No "force-dynamic" export: route handlers are not cached by default; adding it
// conflicts with cacheComponents:true in next.config.ts. The SSE headers below
// (Cache-Control: no-cache) are sufficient to prevent any intermediary caching.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: object) => controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
      send({ type: "artifact", payload: { scanId: id, label: "reviews fetched", count: 0 } });
      send({ type: "done", payload: { scanId: id } });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
