import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep, subjectBrandNamesForApp } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { getSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";
import { seedPlanFromSynthesis, MAX_SEEDED } from "@/lib/scan/plan-seed";

/**
 * /api/app/plan/generate — "Generate more actions" for the plan page.
 *
 * Surfaces MORE of the app's already-computed recommendations (the synthesis
 * `contentPlan`/`distributionPlan` — the same cached output the Synthesis/Plans
 * intel pages already read) as real, persisted `pending` actions. This is
 * deliberately NOT a fresh-generation endpoint: no per-click LLM action-writing
 * call, no fresh external (DataForSEO/Tavily) scan in the common (warm-cache)
 * path — `gatherSynthesis` is the exact same cached call `/api/app/intel?layer=synthesis`
 * makes, so a founder who has already opened the Plans page gets an instant,
 * cache-hit response here.
 *
 * A2 (2026-07-26): the synthesis → tracked-actions persistence lives in the ONE
 * shared `seedPlanFromSynthesis` (lib/scan/plan-seed.ts) — the same seeder the
 * onboarding competitor-approval uses — so the funnel-grounded distribution plan
 * feeds the tracked plan through a single path (dedupe + rank + cap + honest
 * impact + §11 no-auto all live there).
 *
 * POST { higherImpactOnly?: boolean } → 200 { added: {id,title,category}[] }
 *   402 EntitlementError (assertPaid gate, mirrors app/api/app/intel/route.ts
 *   EXACTLY — this route triggers the same class of metered spend on a cache
 *   miss and must never be reachable by an inactive/free viewer).
 *   400 no active app / no subject domain. 401 unauthenticated.
 */

/** Return `s` only if it is a real calendar date (round-trips through Date);
 *  null otherwise. Guards the `scheduled_for` date-column insert. */
function validCalendarDate(s: string | undefined): string | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}

const Body = z.object({
  higherImpactOnly: z.boolean().optional(),
  // The founder's LOCAL calendar day ("YYYY-MM-DD"), so the generated actions
  // pin to the same "today" their plan renders (the server clock/timezone may
  // differ). Validated; falls back to the server date when absent/malformed.
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) {
    return NextResponse.json({ message: "authentication required" }, { status: 401 });
  }

  // Paid gate BEFORE any gather — mirrors app/api/app/intel/route.ts exactly
  // (the /app UI paywall does not protect this API; invariant #5b).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(raw ?? {});
  const higherImpactOnly = parsed.success ? (parsed.data.higherImpactOnly ?? false) : false;
  // Pin generated actions to the founder's today (their local date, or the
  // server's UTC date as a safe fallback) so they land on the day they asked.
  // The regex passes well-formed-but-impossible dates ("2026-13-45"); validate
  // as a REAL calendar date so a broken client degrades to the server date
  // rather than 500ing on the date-column insert.
  const scheduledFor = validCalendarDate(parsed.success ? parsed.data.today : undefined)
    ?? new Date().toISOString().slice(0, 10);

  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ message: "no active app" }, { status: 400 });

  const { data: appRow } = await serverDb().from("apps").select("store_url").eq("id", appId).maybeSingle();
  const domain = (appRow?.store_url as string | null) ?? null;
  if (!domain) return NextResponse.json({ message: "no subject domain" }, { status: 400 });

  try {
    const added = await costedIntelStep(appId, "plan-generate", async () => {
      const competitors = await getSelectedCompetitors(appId);
      // Cache-only: the SAME cached synthesis the Synthesis/Plans intel pages
      // read (gatherSynthesis is itself cached 7d by domain+cohort) — a warm
      // cache means this whole step costs nothing extra. RC1 parity: same
      // subject-brand-name fold-in as /api/app/intel, for a cold cache miss.
      const brandNames = await subjectBrandNamesForApp(appId);
      const synth = await gatherSynthesis(domain, { competitorDomains: competitors, brandNames });

      // The ONE shared seeder (A2) — dedupe + rank + cap + honest impact + §11
      // no-auto all live in lib/scan/plan-seed.ts, shared with competitor-approval.
      // Pin to the founder's today so "generate more" lands on the day they asked.
      return seedPlanFromSynthesis({
        appId, synth, scheduledFor, higherImpactOnly, max: MAX_SEEDED,
      });
    });

    return NextResponse.json({ added });
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
