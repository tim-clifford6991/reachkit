/**
 * /api/test-content?domain=<host>[&competitors=a.com,b.com]
 *
 * Auth-free harness for testing the content-intelligence gatherer end-to-end.
 * Calls gatherContentIntel directly and returns the full ContentIntel payload
 * so classified pages + topic clusters + domain_content_page persistence can
 * all be verified without going through the authenticated /api/app/intel route.
 */
import { NextRequest, NextResponse } from "next/server";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { gatherContentIntel } from "@/lib/scan/content/gather";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("domain")?.trim();
  if (!raw) return NextResponse.json({ error: "domain required" }, { status: 400 });

  const domain = normalizeHost(raw);
  const coParam = req.nextUrl.searchParams.get("competitors")?.trim();
  const competitorDomains = coParam ? coParam.split(",").map((d) => d.trim()).filter(Boolean) : undefined;

  try {
    const result = await gatherContentIntel(domain, { competitorDomains });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
