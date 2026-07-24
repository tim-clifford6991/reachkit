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
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep, subjectBrandNamesForApp } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherFullFunnel } from "@/lib/scan/referral/funnel";
import { gatherDemand } from "@/lib/scan/demand/gather";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";
import { gatherContentIntel } from "@/lib/scan/content/gather";
import type { StageEvent } from "@/lib/scan/types";

// Matches the non-stream fallback route (app/api/app/intel/route.ts). A cold
// supply gather runs three gatherers and can take 120–240s; a 120s cap would
// KILL the stream mid-compute, the client's EventSource would `onerror`, and the
// plain-fetch fallback would launch a SECOND full (cost-metered) gather while the
// orphaned first one keeps spending. 240 gives the stream time to actually finish.
export const maxDuration = 240;

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

  // Paid entitlement — same gate as the non-stream route (§6 #6). Returned as a
  // proper HTTP error before the stream opens (mirrors the 401 handling above), so
  // an unentitled caller can never start a metered gather.
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    const status = e instanceof EntitlementError ? 402 : 500;
    const error = e instanceof EntitlementError ? "upgrade required" : "unexpected entitlement error";
    return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
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
  // RC1 parity: same subject-brand-name fold-in as the non-stream route.
  const brandNames = await subjectBrandNamesForApp(appId);

  // Flipped by the stream's cancel() when the client disconnects, so post-disconnect
  // send() calls become no-ops instead of throwing on an enqueue to a dead controller.
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      /** Enqueue one SSE frame; no-op after client disconnect, swallows enqueue errors. */
      const send = (data: object) => {
        if (cancelled) return;
        try { controller.enqueue(sseFrame(data)); } catch { /* client gone */ }
      };

      const onStage = (s: StageEvent) => send({ type: "stage", ...s });

      try {
        // costedIntelStep: cold-path external spend attributes to the latest
        // scan row + `intel-spend` event (CLAUDE.md invariant #2).
        const payload: unknown = await costedIntelStep(appId, "intel-stream", async () => {
          if (layer === "demand") {
            return gatherDemand(domain, { competitorDomains: co, onStage });
          }
          if (layer === "synthesis") {
            return gatherSynthesis(domain, { competitorDomains: co, onStage, brandNames });
          }
          // supply (default) — gatherers run in parallel; each fires onStage
          // independently so progress events interleave naturally. The keyword-gap
          // gather was dropped here (2026-07-24) to match the non-stream route: its
          // `keywords.gaps` renders on NO mounted Supply view yet fired 6× metered
          // ranked_keywords per cold load. Synthesis re-gathers it for the plan.
          const [funnel, content] = await Promise.all([
            gatherFullFunnel(domain, { competitorDomains: co, onStage }),
            gatherContentIntel(domain, { competitorDomains: co, onStage }),
          ]);
          return { funnel, keywords: null, content };
        });

        send({ type: "done", payload });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "failed" });
      }

      try { controller.close(); } catch { /* already closed */ }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
