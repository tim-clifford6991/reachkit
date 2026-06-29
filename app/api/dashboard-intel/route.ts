/**
 * /api/dashboard-intel?domain=<host>[&competitors=a.com,b.com] — competitive
 * distribution intel for the dashboard. When competitors are given and the caller
 * is authed, the freshly computed intel is also persisted into the latest scan's
 * report_payload so subsequent dashboard loads render instantly (no DataForSEO spend).
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { activeAppId } from "@/lib/app/active-app";
import { serverDb } from "@/lib/db/client";
import { gatherDashboardIntel, persistCompetitiveIntel } from "@/lib/scan/referral/intel";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const competitorDomains = (req.nextUrl.searchParams.get("competitors") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const intel = await gatherDashboardIntel(domain, competitorDomains.length ? { competitorDomains } : {});

    // Self-heal: persist the current-shape intel so the next load is instant.
    if (competitorDomains.length) {
      try {
        const viewer = await currentUser();
        const appId = viewer ? await activeAppId(viewer.user) : null;
        if (appId) {
          const { data: scan } = await serverDb()
            .from("scans")
            .select("id")
            .eq("app_id", appId)
            .order("completed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (scan?.id) await persistCompetitiveIntel(scan.id as string, intel);
        }
      } catch (e) {
        console.error("[dashboard-intel] persist failed (best-effort)", e);
      }
    }

    return NextResponse.json(intel);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
