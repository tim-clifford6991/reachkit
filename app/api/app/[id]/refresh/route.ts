import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth/server";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { runWeeklyRefresh } from "@/lib/scan/refresh";
import { isoWeekStart } from "@/lib/inngest/functions/weekly-refresh";
import type { ScanContext } from "@/lib/scan/pipeline";

type Platform = ScanContext["mode"];
function isPlatform(p: string): p is Platform {
  return p === "ios" || p === "android" || p === "web";
}

/**
 * Manual refresh trigger (Cycle 4 Task 10) — on-demand sibling of the weekly cron.
 *
 * Gating: must be an authenticated user (401), who owns the app (app_ids includes
 * the id — else 404), with an active paid subscription (402). Then build the
 * ScanContext from the app's latest scan and await runWeeklyRefresh DIRECTLY
 * (fine for an on-demand/testing trigger; the cron is the scheduled fan-out path).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: appId } = await params;
  if (!appId) {
    return NextResponse.json({ error: "missing app id" }, { status: 400 });
  }

  // 1. Auth.
  let userId: string;
  let appIds: string[];
  try {
    const { user } = await requireUser();
    userId = user.id;
    appIds = user.app_ids ?? [];
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }
    return NextResponse.json({ error: "unexpected auth error" }, { status: 500 });
  }

  // 2. Ownership — the app must belong to this user.
  if (!appIds.includes(appId)) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }

  // 3. Paid entitlement.
  try {
    await assertPaid(userId);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return NextResponse.json({ error: "upgrade required" }, { status: 402 });
    }
    return NextResponse.json({ error: "unexpected entitlement error" }, { status: 500 });
  }

  // 4. Reconstruct context from the app + its latest scan, then refresh.
  const db = serverDb();

  const { data: app, error: appErr } = await db
    .from("apps")
    .select("id, store_url, platform")
    .eq("id", appId)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json({ error: "failed to load app" }, { status: 500 });
  }
  if (!app || !isPlatform(app.platform)) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }

  // 4a. Once-per-week guard (same as the cron): if a score_snapshots row already
  // exists for this app within the current ISO week, the refresh already ran —
  // skip WITHOUT calling runWeeklyRefresh so a paid owner hammering this endpoint
  // can't re-spend Haiku/Sonnet or write duplicate snapshots. (The user still sees
  // this week's data via the queue API.)
  const weekStart = isoWeekStart(new Date());
  const { data: snap, error: snapErr } = await db
    .from("score_snapshots")
    .select("id")
    .eq("app_id", appId)
    .gte("taken_at", weekStart)
    .limit(1)
    .maybeSingle();
  if (snapErr) {
    return NextResponse.json({ error: "failed to check refresh state" }, { status: 500 });
  }
  if (snap) {
    return NextResponse.json({ skipped: true, reason: "already refreshed this week" });
  }

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (scanErr) {
    return NextResponse.json({ error: "failed to load scan" }, { status: 500 });
  }
  if (!scanRow) {
    return NextResponse.json({ error: "no scan to refresh for this app" }, { status: 409 });
  }

  const ctx: ScanContext = {
    scanId: scanRow.id,
    appId,
    storeUrl: app.store_url,
    mode: app.platform,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: env.scanBudgetCents }),
  };

  try {
    const result = await runWeeklyRefresh(ctx);
    return NextResponse.json(result);
  } catch (e) {
    console.error("app/[id]/refresh POST error", e);
    return NextResponse.json({ error: "refresh failed" }, { status: 500 });
  }
}
