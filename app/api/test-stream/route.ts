/**
 * /api/test-stream?domain=<host>&layer=supply|demand|synthesis
 *
 * No-auth development harness for the SSE streaming path. Mirrors the gather
 * logic of /api/app/intel/stream but resolves the cohort automatically (no user
 * or competitor selection required) so it can be curl'd directly:
 *
 *   curl -N --max-time 120 "http://localhost:3000/api/test-stream?domain=nudgi.ai&layer=supply"
 *
 * Matches the pattern of the other test-* routes (no auth, heavy, first run 30–60s).
 */
import { NextRequest } from "next/server";
import { gatherFullFunnel } from "@/lib/scan/referral/funnel";
import { gatherKeywordGap } from "@/lib/scan/referral/keyword-gap";
import { gatherDemand } from "@/lib/scan/demand/gather";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";
import { gatherContentIntel } from "@/lib/scan/content/gather";
import type { StageEvent } from "@/lib/scan/types";

export const maxDuration = 120;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
} as const;

function sseFrame(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) {
    return new Response(JSON.stringify({ error: "domain required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const layer = req.nextUrl.searchParams.get("layer") ?? "supply";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(sseFrame(data)); } catch { /* client gone */ }
      };

      const onStage = (s: StageEvent) => send({ type: "stage", ...s });

      try {
        let payload: unknown;

        if (layer === "demand") {
          payload = await gatherDemand(domain, { onStage });
        } else if (layer === "synthesis") {
          payload = await gatherSynthesis(domain, { onStage });
        } else {
          // supply
          const [funnel, keywords, content] = await Promise.all([
            gatherFullFunnel(domain, { onStage }),
            gatherKeywordGap(domain, { onStage }),
            gatherContentIntel(domain, { onStage }),
          ]);
          payload = { funnel, keywords, content };
        }

        send({ type: "done", payload });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "failed" });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
