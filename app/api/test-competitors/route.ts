/**
 * /api/test-competitors?domain=<host> — focused harness for tuning competitor
 * discovery accuracy. Returns the inferred category, the full candidate pool, and
 * the LLM closeness ranking (score + reason per candidate) so we can iterate on
 * surfacing the CLOSEST direct competitors. Fast (~8s; no referral/classify).
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { discoverClosestCompetitors, type TraceStep } from "@/lib/scan/referral/discover-competitors";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const self = normalizeHost(domain);
  const trace: TraceStep[] = [];
  try {
    const result = await discoverClosestCompetitors(self, trace);
    return NextResponse.json({ subject: self, ...result, trace });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed", trace }, { status: 500 });
  }
}
