// src/app/api/scan/[scanId]/progress/route.ts — BP-022 `## Public
// interface`, WO-281 (consolidates WO-063; see `archive/sdlc-factory-2026-09-04/corpus/docs/
// work-orders/WO-281.md` `## Consolidation`)
//
// "Serve BP-023's stage stream as server-sent events and nothing more —
// one thin adapter" (WO-063's own goal, carried verbatim). This file
// holds no timer, no stage list and no ending logic of its own
// (`structure.md` rule 1): it opens `@/lib/scan/stages`'s `progress(scanId)`,
// serialises each `StageEvent` verbatim as one SSE `data:` frame — no
// renaming and no field this module adds on its own account (WO-281
// `## Steps` step 16) — and closes the response after the single `ending`
// event, releasing the iterator either way (step 17).
//
// **The 404 decision.** `progress()` itself states no HTTP status — it is
// a plain async iterable. An unknown or malformed `scanId` (`stages.ts`'s
// own read of the `scans` row) yields an iterable that produces nothing at
// all; this route reads that as "unknown or malformed `scanId` responds
// 404 on this API route" (step 19) by pulling exactly one event before
// deciding which response to build. A known scan that has recorded
// nothing yet is not this case: `progress()` opens with a heartbeat on its
// first database read rather than returning, so this one pull never
// spuriously 404s a scan that is simply early — and never holds the
// response un-answered until the pass's first transition (issue #540).
//
// **Disconnect.** `ReadableStream`'s own `cancel()` — called by the
// platform when the client goes away, the same mechanism a real browser
// closing the tab triggers — releases the iterator (step 18: "no
// background continuation for a visitor who closes the page"). No other
// handle is held past that point: no interval, and no further read of the
// scan's recorded log, which `stages.ts` stops making in its own `finally`
// block the moment the iterator is returned.
import { progress, type StageEvent } from "@/lib/scan/stages";

// ── What this response needs from the platform, stated (issue #540) ──────
//
// The file used to declare none of this and rely on the defaults being
// what a stream wants. They are not all of it, and an implied requirement
// is one nobody can check, so each is written down with what it is for.
// Read against `next/dist/docs` for the version in `package-lock.json`
// (16.3.4).

/** **A stream is never a cached response.** Without this the route is a
 *  candidate for static handling — it takes no dynamic API beyond its own
 *  params — and a cached progress stream is one visitor's scan replayed to
 *  the next. `revalidate = 0` is its twin, the same pair
 *  `src/app/(public)/scan/[domain]/page.tsx` and `sitemap.xml/route.ts`
 *  already declare. (`docs/01-app/02-guides/caching-without-cache-components.md`:
 *  force-dynamic "Force dynamic rendering, which will result in routes
 *  being rendered for each user at request time".) */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** **The invocation must outlive the pass it is watching.** The free pass
 *  is bounded at `TIMING.reportCeilingS` inside an invocation the platform
 *  freezes at `TIMING.platformCeilingS`; a stream cut off before that
 *  loses the one `ending`, and the visitor is left on the progress view
 *  that this issue is about. 60 is the same number and the same Hobby-plan
 *  bound `src/app/api/scan/route.ts` pins, and like that one it is a
 *  literal because Next reads route segment config out of the source at
 *  build time (`docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`).
 *  An `EventSource` reconnects of its own accord if the platform does cut
 *  the connection, and `progress()` replays the recorded log to the
 *  reconnecting subscriber, so nothing is lost either way. */
export const maxDuration = 60;

// **No `runtime` export.** The default is `nodejs`, and the only other
// value is `'edge'`, which this version deprecates outright: "The Edge
// Runtime is deprecated. Remove the `runtime` export from your route
// files." (`…/02-route-segment-config/runtime.md`). Declaring the default
// would be noise; declaring `edge` would be declaring a deprecation.

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
} as const;

/** **Nothing between this process and the visitor may buffer the body.**
 *  Vercel streams natively, but a reverse proxy in front of a self-hosted
 *  deployment buffers by default, and a buffered SSE response is
 *  indistinguishable from the dead stream this issue reports. Next's own
 *  guide names this exact header for it: "Nginx and similar reverse
 *  proxies buffer responses by default. Disable buffering by setting the
 *  `X-Accel-Buffering` header to `no`"
 *  (`docs/01-app/02-guides/streaming.md`, "What can affect streaming").
 *  It is set on this response rather than in `next.config.ts` because it
 *  is true of this route and of nothing else the product serves. */
const NO_BUFFERING = "no";

/** **The first bytes, before any event.** Two things buffer a stream's
 *  opening independently of any proxy: a compression layer, which holds
 *  chunks back until it has enough to compress, and WebKit, which "buffers
 *  streaming responses until 1024 bytes have been received" (same guide).
 *  Both are measured in bytes, and this response's frames are tens of
 *  bytes each, so the opening is padded past the larger of the two. It is
 *  an SSE *comment* — a line beginning `:` — which every client is
 *  required to ignore, so it adds no event and changes nothing a reader
 *  parses. */
const PREAMBLE = `${":".padEnd(2048, " ")}\n\n`;

function sseFrame(event: StageEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
): Promise<Response> {
  const { scanId } = await params;
  const iterator = progress(scanId)[Symbol.asyncIterator]();

  const first = await iterator.next();
  if (first.done) {
    return new Response(null, { status: 404, headers: RESPONSE_HEADERS });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // One chunk, so the padding can never arrive without the event it is
      // there to push through.
      controller.enqueue(encoder.encode(PREAMBLE + sseFrame(first.value)));
      if ("ending" in first.value) {
        controller.close();
        return;
      }
      try {
        while (true) {
          const next = await iterator.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(sseFrame(next.value)));
          if ("ending" in next.value) break;
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      void iterator.return?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...RESPONSE_HEADERS,
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "X-Accel-Buffering": NO_BUFFERING,
    },
  });
}
