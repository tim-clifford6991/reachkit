/**
 * /api/test-keywords?domain=<host> — keyword-gap funnel: where competitors rank
 * (top 30) that the subject doesn't, cross-referenced across rivals, with the
 * ranking-page URL per competitor. Test harness (~15–25s).
 */
import { NextRequest, NextResponse } from "next/server";
import { gatherKeywordGap } from "@/lib/scan/referral/keyword-gap";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    return NextResponse.json(await gatherKeywordGap(domain));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
