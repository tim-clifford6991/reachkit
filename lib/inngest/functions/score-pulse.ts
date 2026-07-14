/**
 * Score pulse cron — the midweek heartbeat between Monday weekly refreshes.
 *
 * Thursdays 09:00 UTC, fan-out across active paid apps (same selection as the
 * weekly refresh), one isolated step per app so a single failure never aborts
 * the fleet. Each pulse is FREE by construction (lib/scan/pulse.ts): one
 * own-site GET + deterministic recompute; DataForSEO is never touched.
 *
 * Idempotency: an app with any score_snapshot in the last 3 days is skipped —
 * the founder's own activity (verify-triggered snapshots) counts as a pulse.
 */

import { inngest } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { runScorePulse } from "@/lib/scan/pulse";

const PAID_TIERS = ["solo", "growth"] as const;
// "trialing" is impossible (no trial); "past_due" is intentionally EXCLUDED —
// a failed-payment account keeps dashboard access during grace (entitlements)
// but we do NOT spend on its weekly refresh/pulse until payment recovers.
const ACTIVE_STATUSES = ["active"] as const;

/** Deduped app ids belonging to every active paid user (weekly-refresh idiom). */
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
    for (const id of (row.app_ids as string[] | null) ?? []) ids.add(id);
  }
  return [...ids];
}

async function pulseOneApp(appId: string): Promise<{ appId: string; skipped: boolean; total?: number }> {
  const db = serverDb();

  // Skip when the score already moved in the last 3 days (weekly refresh,
  // verify snapshot, or a prior pulse) — no point re-measuring a fresh score.
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await db
    .from("score_snapshots")
    .select("id")
    .eq("app_id", appId)
    .gte("taken_at", cutoff)
    .limit(1)
    .maybeSingle();
  if (recent) return { appId, skipped: true };

  const result = await runScorePulse(appId);
  return { appId, ...result };
}

export const scorePulse = inngest.createFunction(
  {
    id: "score-pulse",
    retries: 1,
    triggers: [{ cron: "0 9 * * 4" }],
  },
  async ({ step }) => {
    const appIds = await step.run("list-active-paid-apps", activePaidAppIds);

    const results: { appId: string; skipped: boolean; total?: number }[] = [];
    for (const appId of appIds) {
      results.push(await step.run(`pulse-${appId}`, () => pulseOneApp(appId)));
    }

    return {
      apps: results.length,
      pulsed: results.filter((r) => !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
    };
  },
);
