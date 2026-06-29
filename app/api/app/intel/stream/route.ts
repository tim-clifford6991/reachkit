/**
 * /api/app/intel/stream?layer=supply|demand|synthesis
 *
 * SSE streaming counterpart to /api/app/intel. Mirrors the same auth + cohort
 * resolution, then runs the identical gather(s) with an `onStage` callback that
 * enqueues progress events into the stream. On completion it enqueues a `done`
 * event carrying the EXACT same payload shape the non-stream route returns.
 *
 * Event shapes (JSON, newline-delimited SSE):
 *   { type: "stage", key: string, label: string, detail?: string }
 *   { type: "done",  payload: <same as /api/app/intel JSON body> }
 *   { type: "error", message: string }
 *
 * The non-stream route is unmodified; this route is purely additive.
 */
import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
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

/** Encode one SSE message frame. */
function sseFrame(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: NextRequest) {
  // Auth — resolve viewer before opening the stream so we can return a proper
  // HTTP error (not an SSE error event) on unauthenticated requests.
  const viewer = await currentUser();
  if (!viewer) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const layer = req.nextUrl.searchParams.get("layer") ?? "supply";

  const appId = await activeAppId(viewer.user);
  if (!appId) {
    return new Response(JSON.stringify({ error: "no active app" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) {
    return new Response(JSON.stringify({ error: "no subject domain" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const competitors = await getSelectedCompetitors(appId);
  if (competitors.length === 0) {
    return new Response(JSON.stringify({ error: "no competitors selected", needsOnboarding: true }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  const co = competitors;

  const stream = new ReadableStream({
    async start(controller) {
      /** Enqueue one SSE frame; swallows errors if the client already disconnected. */
      const send = (data: object) => {
        try { controller.enqueue(sseFrame(data)); } catch { /* client gone */ }
      };

      const onStage = (s: StageEvent) => send({ type: "stage", ...s });

      try {
        let payload: unknown;

        if (layer === "demand") {
          payload = await gatherDemand(domain, { competitorDomains: co, onStage });
        } else if (layer === "synthesis") {
          payload = await gatherSynthesis(domain, { competitorDomains: co, onStage });
        } else {
          // supply (default) — three gatherers run in parallel; each fires onStage
          // independently so progress events from all three interleave naturally.
          const [funnel, keywords, content] = await Promise.all([
            gatherFullFunnel(domain, { competitorDomains: co, onStage }),
            gatherKeywordGap(domain, { competitorDomains: co, onStage }),
            gatherContentIntel(domain, { competitorDomains: co, onStage }),
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
