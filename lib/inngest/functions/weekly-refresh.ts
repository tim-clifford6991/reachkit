/**
 * Weekly scheduled refresh (Cycle 4 Task 10) — the cron that drives the paid
 * engine's delta-refresh once a week, fanning out across every active paid app.
 *
 * Shape:
 *   - Trigger: cron "0 9 * * 1" → Mondays 09:00 UTC.
 *   - Fan-out: query the set of ACTIVE PAID apps (users tier in solo/growth AND
 *     subscription_status in active/trialing → their deduped app_ids), then run a
 *     SEPARATE step.run("refresh-<appId>") per app so one app's failure can never
 *     abort the rest of the fleet (each step is independently retried/replayed).
 *   - Per app: reconstruct a ScanContext from the app row (store_url, platform) +
 *     the app's latest scan id, guard once-per-week idempotency (skip if a
 *     score_snapshots row already exists for the app within the current ISO week),
 *     run runWeeklyRefresh, then emit a "refresh" scan_event on the latest scan id
 *     (the weekly digest log the feed UI reads).
 *
 * Fixture-aware end-to-end: runWeeklyRefresh short-circuits every model/embed call
 * when fixtures are on, so this whole cron runs keyless in dev/test.
 */

import { inngest } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { env } from "@/lib/config/env";
import { ScanBudget } from "@/lib/tools/registry";
import { runWeeklyRefresh } from "@/lib/scan/refresh";
import { emitScanEvent } from "@/lib/scan/progress";
import type { ScanContext } from "@/lib/scan/pipeline";

// Active-paid selection: paid tiers whose subscription is live.
const PAID_TIERS = ["solo", "growth"] as const;
const ACTIVE_STATUSES = ["active", "trialing"] as const;

type Platform = ScanContext["mode"];
function isPlatform(p: string): p is Platform {
  return p === "ios" || p === "android" || p === "web";
}

/**
 * Monday 00:00:00.000 UTC of the ISO week containing `now`, as an ISO string.
 * Used as the lower bound for the once-per-week score_snapshots idempotency
 * guard (an app already snapshotted this ISO week is skipped).
 */
export function isoWeekStart(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: Sun=0..Sat=6 → days since Monday (Mon=0..Sun=6).
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString();
}

/** Deduped app ids belonging to every active paid user. */
async function activePaidAppIds(): Promise<string[]> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .select("app_ids")
    .in("tier", PAID_TIERS as unknown as string[])
    .in("subscription_status", ACTIVE_STATUSES as unknown as string[]);
  if (error) throw error;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    for (const id of row.app_ids ?? []) ids.add(id);
  }
  return [...ids];
}

interface AppRefreshSummary {
  appId: string;
  skipped: boolean;
  noOp?: boolean;
  changes?: number;
  newActions?: number;
  weekOf?: string;
}

/**
 * Refresh a single app: reconstruct its context, guard once-per-week, run the
 * delta refresh, and log the "refresh" digest event on the latest scan id.
 * Returns a small summary; throws on a genuine failure so the per-app step is
 * retried/surfaced without affecting sibling apps.
 */
async function refreshOneApp(appId: string): Promise<AppRefreshSummary> {
  const db = serverDb();

  // Load the app (store_url + platform).
  const { data: app, error: appErr } = await db
    .from("apps")
    .select("id, store_url, platform")
    .eq("id", appId)
    .maybeSingle();
  if (appErr) throw appErr;
  if (!app) return { appId, skipped: true };
  if (!isPlatform(app.platform)) return { appId, skipped: true };

  // Once-per-week idempotency: skip if a snapshot already exists this ISO week.
  const weekStart = isoWeekStart(new Date());
  const { data: snap, error: snapErr } = await db
    .from("score_snapshots")
    .select("id")
    .eq("app_id", appId)
    .gte("taken_at", weekStart)
    .limit(1)
    .maybeSingle();
  if (snapErr) throw snapErr;
  if (snap) return { appId, skipped: true };

  // Latest scan id for the app — the refresh's scanId + the event's anchor.
  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (scanErr) throw scanErr;
  if (!scanRow) return { appId, skipped: true };

  const latestScanId = scanRow.id;

  const ctx: ScanContext = {
    scanId: latestScanId,
    appId,
    storeUrl: app.store_url,
    mode: app.platform,
    budget: new ScanBudget({ maxToolCalls: 60, budgetCents: env.weeklyRefreshBudgetCents }),
  };

  const result = await runWeeklyRefresh(ctx);

  // The weekly digest log the feed UI reads, anchored on the latest scan id.
  await emitScanEvent(latestScanId, "refresh", {
    weekOf: result.weekOf,
    noOp: result.noOp,
    changes: result.changes,
    newActions: result.newActions,
    alerts: result.alerts,
  });

  return {
    appId,
    skipped: false,
    noOp: result.noOp,
    changes: result.changes.length,
    newActions: result.newActions,
    weekOf: result.weekOf,
  };
}

export const weeklyRefresh = inngest.createFunction(
  {
    id: "weekly-refresh",
    retries: 1,
    triggers: [{ cron: "0 9 * * 1" }],
    onFailure: async ({ error }) => {
      // Cron has no originating scan event; the per-app steps already isolate
      // individual app failures, so a top-level failure here is the fan-out
      // itself (e.g. the active-paid query). Log it for ops visibility.
      const message = error instanceof Error ? error.message : String(error);
      console.error("[weekly-refresh] run failed:", message);
    },
  },
  async ({ step }) => {
    // Fan-out set: the active paid apps. Memoized in a step so a replay does not
    // re-query and the per-app steps below get a stable list.
    const appIds = await step.run("collect-active-paid-apps", activePaidAppIds);

    // One isolated step per app — a single app's failure cannot abort the fleet.
    const summaries: AppRefreshSummary[] = [];
    for (const appId of appIds) {
      const summary = await step.run(`refresh-${appId}`, () => refreshOneApp(appId));
      summaries.push(summary);
    }

    const refreshed = summaries.filter((s) => !s.skipped).length;
    const skipped = summaries.filter((s) => s.skipped).length;
    return { apps: appIds.length, refreshed, skipped, summaries };
  },
);
