/**
 * POST /api/competitors/select { domains: string[] } — persist the user's chosen
 * benchmark competitors (≤5) for their active app, then PRE-COMPUTE the full
 * intel (Supply + Demand + Synthesis + Plans) in the background so every page is
 * already warm on first visit. The response returns immediately; the heavy work
 * runs in `after()` and writes through the global cache (de-duplicated, so a page
 * fetch that arrives mid-compute shares the same run rather than double-spending).
 */
import { NextRequest, NextResponse, after } from "next/server";
import { currentUser } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { activeAppId } from "@/lib/app/active-app";
import { costedIntelStep } from "@/lib/app/latest-scan";
import { serverDb } from "@/lib/db/client";
import { saveSelectedCompetitors } from "@/lib/scan/competitor-selection";
import { resolveCompetitorDomain } from "@/lib/scan/competitor-resolve";
import { normalizeHost } from "@/lib/scan/referral/classify";
import { gatherSynthesis } from "@/lib/scan/synthesis/synthesize";

export const maxDuration = 240;

export async function POST(req: NextRequest) {
  const viewer = await currentUser();
  if (!viewer) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // Paid entitlement — this route pre-computes the full cohort intel via
  // gatherSynthesis in after() (~€1 of DataForSEO/Tavily/LLM). Gating it closes a
  // cost + entitlement leak: the /app paywall hid the picker but not this API (§6 #6).
  try {
    await assertPaid(viewer.user.id);
  } catch (e) {
    if (e instanceof EntitlementError) return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }
  const appId = await activeAppId(viewer.user);
  if (!appId) return NextResponse.json({ error: "no active app" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { domains?: unknown; names?: unknown } | null;
  const domains = Array.isArray(body?.domains) ? body!.domains.map((d) => String(d)).filter(Boolean) : [];
  // 2B — name-only picks (competitors we couldn't auto-resolve at candidate time)
  // are resolved here, on commit. Anything that still won't resolve is simply
  // dropped (no domain → no intel possible), so the cohort stays clean.
  const names = Array.isArray(body?.names) ? body!.names.map((n) => String(n)).filter(Boolean) : [];

  try {
    const resolvedFromNames = (
      await Promise.all(names.map((n) => resolveCompetitorDomain(n).catch(() => null)))
    ).filter((h): h is string => !!h);
    const allDomains = [...new Set([...domains, ...resolvedFromNames.map((h) => normalizeHost(h))].filter(Boolean))];

    const saved = await saveSelectedCompetitors(appId, allDomains);

    const db = serverDb();
    const { data: appRow } = await db.from("apps").select("store_url").eq("id", appId).maybeSingle();
    const storeUrl = (appRow?.store_url as string | null) ?? null;

    // Warm every layer for the chosen cohort in the background. gatherSynthesis
    // calls the funnel + keyword-gap + demand gatherers (each top-level cached),
    // so this single pass populates the caches all four pages read.
    if (storeUrl && saved.length > 0) {
      after(async () => {
        try {
          // costedIntelStep: this pre-compute is the single heaviest interactive
          // spend point (~€1 cold) — attribute it (CLAUDE.md invariant #2).
          await costedIntelStep(appId, "select", () =>
            gatherSynthesis(storeUrl, { competitorDomains: saved }),
          );
        } catch (e) {
          console.error("[competitors/select] pre-compute failed (best-effort)", e);
        }
      });
    }

    return NextResponse.json({ ok: true, selected: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
