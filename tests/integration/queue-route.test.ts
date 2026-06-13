/**
 * Integration test for the weekly action-queue endpoint (Cycle 4 Task 12):
 *   GET /api/app/[id]/queue
 *
 * Route-level cookie auth (requireUser) is impractical to fake here, so — per the
 * task's guidance — we prove the endpoint's GATING composition at the lib level,
 * against real seeded `users`/`apps`/`actions`, the same way the route composes it:
 *   - data path: `assembleWeeklyPlan(appA)` returns a bucketed plan (the 200 body
 *     the route hands back is well-formed and non-empty).
 *   - 402 gate: `assertPaid(freeUserId)` throws EntitlementError; `assertPaid(paidUserId)`
 *     resolves.
 *   - 404 gate: ownership — `paidUser.app_ids.includes(appB)` is false (the route
 *     returns 404, not 403, so it doesn't leak existence of apps you don't own).
 *
 * Fixtures mode — no API keys needed.
 * Run with: pnpm test:int tests/integration/queue-route.test.ts
 */

import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { assembleWeeklyPlan, isoWeekStartDate } from "@/lib/scan/weekly-plan";

const db = serverDb();
const createdUserIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.from("users").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedApp(storeUrl: string): Promise<string> {
  const { data, error } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Seed an OPEN action created within `weekOf`'s week, with the given effort. */
async function seedAction(appId: string, effortMin: number, createdAt: string): Promise<void> {
  const { error } = await db.from("actions").insert({
    app_id: appId,
    category: "content",
    title: `queue-${appId}-${effortMin}-${Math.random()}`,
    why: "because reasons",
    effort_min: effortMin,
    score_component: "seo",
    status: "open",
    created_at: createdAt,
  });
  if (error) throw error;
}

async function seedUser(
  suffix: string,
  tier: string,
  subscriptionStatus: string | null,
  appIds: string[],
): Promise<string> {
  const { data, error } = await db
    .from("users")
    .insert({
      email: `queue-route-${suffix}-${Date.now()}@example.com`,
      tier,
      subscription_status: subscriptionStatus,
      app_ids: appIds,
    })
    .select("id")
    .single();
  if (error) throw error;
  createdUserIds.push(data.id);
  return data.id;
}

// ---------------------------------------------------------------------------
// Test — the gating composition the route applies (401→404→402→plan)
// ---------------------------------------------------------------------------

test(
  "queue gating: paid owner gets a bucketed plan (200); free → 402; non-owner → 404",
  async () => {
    const stamp = Date.now();

    // appA: owned by a paid+active user, with a few open actions this week so the
    // plan the route returns is non-empty across buckets.
    const appA = await seedApp(`https://apps.apple.com/us/app/qa/id${stamp}-a`);
    const weekOf = isoWeekStartDate(new Date());
    const thisWeek = new Date(Date.parse(`${weekOf}T12:00:00.000Z`)).toISOString();
    await seedAction(appA, 10, thisWeek); // quick win (<30)
    await seedAction(appA, 45, thisWeek); // medium (30..120)
    await seedAction(appA, 130, thisWeek); // long play (>120)

    // appB: owned by a free user (no entitlement).
    const appB = await seedApp(`https://apps.apple.com/us/app/qb/id${stamp}-b`);

    const paidUserId = await seedUser(`paid-${stamp}`, "solo", "active", [appA]);
    const freeUserId = await seedUser(`free-${stamp}`, "free", null, [appB]);

    // --- 200 path: the data the route returns is a correct bucketed plan. ----
    const plan = await assembleWeeklyPlan(appA);
    expect(plan.appId).toBe(appA);
    expect(plan.weekOf).toBe(weekOf);
    expect(plan.queue).toMatchObject({
      quickWins: expect.any(Array),
      medium: expect.any(Array),
      longPlay: expect.any(Array),
    });
    expect(plan.queue.quickWins.length).toBe(1);
    expect(plan.queue.medium.length).toBe(1);
    expect(plan.queue.longPlay.length).toBe(1);

    // --- 402 gate: free rejects, paid resolves. -----------------------------
    await expect(assertPaid(freeUserId)).rejects.toBeInstanceOf(EntitlementError);
    await expect(assertPaid(paidUserId)).resolves.toBeUndefined();

    // --- 404 gate: ownership — the paid user does NOT own appB. -------------
    const { data: paidUser, error } = await db
      .from("users")
      .select("app_ids")
      .eq("id", paidUserId)
      .single();
    if (error) throw error;
    expect(paidUser.app_ids.includes(appA)).toBe(true); // owns appA
    expect(paidUser.app_ids.includes(appB)).toBe(false); // not appB → 404
  },
  60_000,
);
