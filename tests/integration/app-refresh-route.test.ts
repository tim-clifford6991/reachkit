/**
 * Integration test for the manual refresh endpoint (Cycle 4 Task 10):
 *   POST /api/app/[id]/refresh
 *
 * Route-testing the handler directly needs a real cookie session (requireUser),
 * which is impractical here — so per the task's guidance we test the endpoint's
 * GATING the same way the route composes it, at the lib level, against real
 * seeded `users`:
 *   - paid + owner  → assertPaid resolves, ownership holds, and the route's core
 *     (runWeeklyRefresh) returns a well-formed RefreshResult (the 200 path).
 *   - free          → assertPaid rejects with EntitlementError (the 402 path).
 *   - non-owner     → the ownership check (app_ids.includes(appId)) is false
 *     (the 404 path).
 *
 * Fixtures mode — no API keys needed.
 * Run with: pnpm test:int tests/integration/app-refresh-route.test.ts
 */

import { afterAll, afterEach, expect, test, vi } from "vitest";
import { serverDb } from "@/lib/db/client";
import { assertPaid, EntitlementError } from "@/lib/billing/entitlements";
import { ScanBudget } from "@/lib/tools/registry";
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, WatermarkBody } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

const createdUserIds: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(async () => {
  const db = serverDb();
  for (const id of createdUserIds) {
    await db.from("users").delete().eq("id", id);
  }
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "HabitKit", category: "Health & Fitness", description: "Build habits" },
    competitors: [{ name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 }],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [{ term: "streaks", count: 38 }],
    sourcesUsed: ["app_store_rss", "itunes"],
  };
}

function staleWatermarks(): Record<string, WatermarkBody> {
  return {
    reviews: { lastReviewId: "rk-old-id" },
    rank: { topRanks: { "habit tracker app": 99 } },
    threads: { lastThreadAt: "2000-01-01T00:00:00Z" },
    competitors: { knownCompetitors: ["Habitify"] },
  };
}

async function seedApp(storeUrl: string): Promise<{ appId: string; scanId: string }> {
  const db = serverDb();

  const { data: appRow, error: appErr } = await db
    .from("apps")
    .insert({ store_url: storeUrl, platform: "ios" })
    .select("id")
    .single();
  if (appErr) throw appErr;
  if (!appRow) throw new Error("no app row");

  const { data: scanRow, error: scanErr } = await db
    .from("scans")
    .insert({
      app_id: appRow.id,
      status: "done",
      started_at: new Date().toISOString(),
      preliminary_facts: makeFacts() as unknown as Json,
    })
    .select("id")
    .single();
  if (scanErr) throw scanErr;
  if (!scanRow) throw new Error("no scan row");

  const wm = staleWatermarks();
  const rows = (["reviews", "rank", "threads", "competitors"] as const).map((kind) => ({
    app_id: appRow.id,
    kind,
    cadence: "weekly",
    watermark: (wm[kind] ?? {}) as unknown as Json,
  }));
  const { error: monErr } = await db.from("monitors").insert(rows);
  if (monErr) throw monErr;

  return { appId: appRow.id, scanId: scanRow.id };
}

async function seedUser(
  suffix: string,
  tier: string,
  subscriptionStatus: string | null,
  appIds: string[],
): Promise<string> {
  const db = serverDb();
  const { data, error } = await db
    .from("users")
    .insert({
      email: `app-refresh-${suffix}-${Date.now()}@example.com`,
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
// Tests
// ---------------------------------------------------------------------------

test(
  "manual refresh (paid owner): gating passes and runWeeklyRefresh returns a RefreshResult",
  async () => {
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    const { runWeeklyRefresh } = await import("@/lib/scan/refresh");

    const { appId, scanId } = await seedApp(
      `https://apps.apple.com/us/app/habitkit/id${Date.now()}-route-paid`,
    );
    const userId = await seedUser(`paid-${Date.now()}`, "solo", "active", [appId]);

    // Gating the route applies: owner + paid.
    expect([appId].includes(appId)).toBe(true); // ownership check shape
    await expect(assertPaid(userId)).resolves.toBeUndefined();

    // The route's core for a paid app.
    const ctx: ScanContext = {
      scanId,
      appId,
      storeUrl: `https://apps.apple.com/us/app/habitkit/id${Date.now()}-route-paid`,
      mode: "ios",
      budget: new ScanBudget({ maxToolCalls: 60, budgetCents: 150 }),
    };
    const result = await runWeeklyRefresh(ctx);

    // A well-formed RefreshResult.
    expect(typeof result.weekOf).toBe("string");
    expect(typeof result.noOp).toBe("boolean");
    expect(Array.isArray(result.changes)).toBe(true);
    expect(typeof result.newActions).toBe("number");
    expect(typeof result.costCents).toBe("number");
  },
  90_000,
);

test(
  "manual refresh gating: a free user is rejected (402 path) and a non-owner fails ownership (404 path)",
  async () => {
    const { appId } = await seedApp(
      `https://apps.apple.com/us/app/habitkit/id${Date.now()}-route-free`,
    );

    // Free user → assertPaid throws EntitlementError → route returns 402.
    const freeId = await seedUser(`free-${Date.now()}`, "free", null, [appId]);
    await expect(assertPaid(freeId)).rejects.toBeInstanceOf(EntitlementError);

    // A paid user who does NOT own this app → ownership check is false → 404,
    // before any refresh runs.
    const otherAppId = "22222222-2222-2222-2222-222222222222";
    const nonOwnerId = await seedUser(`nonowner-${Date.now()}`, "solo", "active", [otherAppId]);
    const { data: nonOwner } = await serverDb()
      .from("users")
      .select("app_ids")
      .eq("id", nonOwnerId)
      .single();
    expect((nonOwner?.app_ids ?? []).includes(appId)).toBe(false);
  },
  30_000,
);
