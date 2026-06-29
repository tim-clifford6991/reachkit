/**
 * /api/test-funnel?domain=<host> — the complete distribution funnel for one URL:
 * category → closest competitors (scored, traffic) → per-competitor backlink
 * drill-down → channels missing → key actions. Test harness (heavy; ~30–60s).
 */
import { NextRequest, NextResponse } from "next/server";
import { gatherFullFunnel } from "@/lib/scan/referral/funnel";

export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    const funnel = await gatherFullFunnel(domain);
    return NextResponse.json(funnel);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
