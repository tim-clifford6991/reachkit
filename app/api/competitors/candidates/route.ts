/**
 * /api/competitors/candidates?domain=<host> — ranked competitor candidates for the
 * onboarding picker: closeness + reason, estimated traffic, and size tier.
 *
 * ONE source (2026-07-27 convergence — intake `onboarding-picker-convergence`):
 * candidates ALWAYS come from `cachedClosestCompetitors` (`cc:<host>`), the same
 * closeness-ranked cohort the intel funnels benchmark against (`cohortFor`). The
 * old scan-seeded fork (`seedFromScan` over the `competitors` table) is retired:
 * it only fired on the checkout/first-app path (where the deep scan had populated
 * the table), while `/app/add` (free scan, empty table) hit this cold path — two
 * sources, two lists, two sizing mechanisms. `cc:` works for BOTH paths, carries
 * native traffic + size tiers, and aligns "pick 5 to benchmark" with the cohort
 * that actually gets benchmarked.
 *
 * Cost-neutral: `cc:<host>` is fetched anyway at select-time by `gatherSynthesis`
 * (`cohortFor`); converging just moves that single 14-day-cached fetch earlier
 * (picker time), then select cache-hits. The deep scan's own competitor discovery
 * (`facts.competitors` → score/gap/monitors) is unchanged.
 *
 * `?refresh=1` busts the domain's cache so the next compute is genuinely fresh.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { cachedClosestCompetitors } from "@/lib/scan/cache/cached-adapters";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // Paid entitlement — the cold path runs DataForSEO/Tavily/LLM discovery; gate it
  // like the rest of the paid onboarding surface (§6 #6).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }
  const domain = req.nextUrl.searchParams.get("domain")?.trim();
  if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
  const fresh = req.nextUrl.searchParams.get("refresh") === "1";

  const self = normalizeHost(domain);

  // refresh=1 → bust the domain-keyed cache entry (mirrors cachedClosestCompetitors'
  // `cc:${norm(self)}` key) so the wrapper below recomputes and re-persists.
  if (fresh) {
    try {
      await serverDb().from("search_cache").delete().eq("key", `cc:${self.trim().toLowerCase()}`);
    } catch (e) {
      console.error("[competitors/candidates] cache bust failed (best-effort)", e);
    }
  }

  try {
    // ONE source. costedIntelStep attributes the cold-compute DataForSEO/Tavily/LLM
    // spend to the viewer's latest scan (invariant #2); a warm `cc:` is an instant read.
    const appId = await activeAppId(viewer.user);
    const result = appId
      ? await costedIntelStep(appId, "candidates", () => cachedClosestCompetitors(self))
      : await cachedClosestCompetitors(self);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
