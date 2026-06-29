/**
 * /api/test-demand?domain=<host> — the DEMAND layer (buyer-anchored, review-
 * independent): ICP, search-demand themes, community pain pockets, and buyer
 * insights mined from competitors' reviews. Heavy first run; cached after.
 */
import { NextRequest, NextResponse } from "next/server";
import { gatherDemand } from "@/lib/scan/demand/gather";

export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  try {
    return NextResponse.json(await gatherDemand(domain));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
