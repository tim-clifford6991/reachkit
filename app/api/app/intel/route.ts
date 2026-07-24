/**
 * /api/app/intel?layer=supply|demand|synthesis — the authenticated data feed for
 * the intel pages. Resolves the viewer's subject domain + chosen competitors and
 * runs the matching gatherer (cohort-scoped). Everything is behind the Phase-1
 * global cache, so first load is heavy and subsequent loads are instant.
 *
 *   supply    → { funnel, content }    (dashboard + competitors)
 *   demand    → DemandIntel            (Demand page)
 *   synthesis → Synthesis              (Synthesis + Plans pages)
 */
import { NextRequest, NextResponse } from "next/server";
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

export const maxDuration = 240;

export async function GET(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Paid entitlement — this feed returns the FULL unredacted deep intel (keyword
  // gap, content plan, thread-level demand) AND triggers metered DataForSEO/Tavily/
  // LLM spend, so it must be gated exactly like its sibling paid routes. The /app
  // UI paywall hides the pages but does NOT protect this API (§6 #6).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }

  const layer = req.nextUrl.searchParams.get("layer") ?? "supply";
  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ error: "no active app" }, { status: 400 });

  const db = serverDb();
  const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) return NextResponse.json({ error: "no subject domain" }, { status: 400 });

  const competitors = await getSelectedCompetitors(appId);
  if (competitors.length === 0) return NextResponse.json({ error: "no competitors selected", needsOnboarding: true }, { status: 409 });

  const co = competitors;
  // RC1 parity: the subject's REAL captured name (facts.listing.name, read back
  // off the latest scan row — this route has no `facts` in scope) joins the
  // brand vocabulary for keyword-gap exactly like the free classifier already
  // does, so a subject whose domain label is unusable/wrong isn't shown its own
  // brand queries as a "rival's gap" opportunity.
  const brandNames = await subjectBrandNamesForApp(appId);
  try {
    // costedIntelStep: cold-path DataForSEO/Tavily spend is attributed to the
    // app's latest scan row + tagged `intel-spend` (CLAUDE.md invariant #2).
    return NextResponse.json(
      await costedIntelStep(appId, "intel", async () => {
        if (layer === "demand") return gatherDemand(domain, { competitorDomains: co });
        if (layer === "synthesis") return gatherSynthesis(domain, { competitorDomains: co, brandNames });
        // supply — the keyword-gap gather was dropped here (2026-07-24): its result
        // (`keywords.gaps`) is rendered by NO mounted Supply view (dashboard/competitors
        // both removed it in the M1/M3a reshape), yet it fired 6× metered ranked_keywords
        // per cold load. Synthesis re-gathers keyword-gap itself for the rendered plan,
        // so nothing that ships loses data. "Never pay for data you don't render."
        const [funnel, content] = await Promise.all([
          gatherFullFunnel(domain, { competitorDomains: co }),
          gatherContentIntel(domain, { competitorDomains: co }),
        ]);
        return { funnel, keywords: null, content };
      }),
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
