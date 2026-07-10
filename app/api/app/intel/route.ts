/**
 * /api/app/intel?layer=supply|demand|synthesis — the authenticated data feed for
 * the intel pages. Resolves the viewer's subject domain + chosen competitors and
 * runs the matching gatherer (cohort-scoped). Everything is behind the Phase-1
 * global cache, so first load is heavy and subsequent loads are instant.
 *
 *   supply    → { funnel, keywords }   (Supply page)
 *   demand    → DemandIntel            (Demand page)
 *   synthesis → Synthesis              (Synthesis + Plans pages)
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherFullFunnel } from "@/lib/scan/referral/funnel";
import { gatherKeywordGap } from "@/lib/scan/referral/keyword-gap";
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
  try {
    if (layer === "demand") return NextResponse.json(await gatherDemand(domain, { competitorDomains: co }));
    if (layer === "synthesis") return NextResponse.json(await gatherSynthesis(domain, { competitorDomains: co }));
    // supply
    const [funnel, keywords, content] = await Promise.all([
      gatherFullFunnel(domain, { competitorDomains: co }),
      gatherKeywordGap(domain, { competitorDomains: co }),
      gatherContentIntel(domain, { competitorDomains: co }),
    ]);
    return NextResponse.json({ funnel, keywords, content });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
