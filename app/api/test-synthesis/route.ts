/**
 * /api/test-synthesis?domain=<host> — the SYNTHESIS layer: Supply × Demand → an
 * evidence-grounded content plan + distribution plan. Reuses the cached funnel,
 * keyword-gap, and demand gatherers; heavy on a cold domain, cheap after.
 */
import { NextRequest, NextResponse } from "next/server";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";

export const maxDuration = 240;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    return NextResponse.json(await gatherSynthesis(domain));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
