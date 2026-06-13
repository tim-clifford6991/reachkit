/**
 * Integration test for the weekly scheduled refresh Inngest function (Cycle 4
 * Task 10). Runs the real `weeklyRefresh` function via @inngest/test's
 * InngestTestEngine (no dev server) against real Supabase, in fixtures mode.
 *
 * Asserts:
 *   1. A PAID app (user tier solo + subscription_status active, with an app +
 *      latest scan + 4 monitors + preliminary_facts) is refreshed by the cron:
 *      a score_snapshots row + a `refresh` scan_event are produced.
 *   2. A FREE app (user tier free) is NOT refreshed: no snapshot, no event.
 *   3. A 2nd run in the SAME ISO week skips the paid app (once-per-week
 *      idempotency): no duplicate score_snapshots row.
 *
 * Run with: pnpm test:int tests/integration/weekly-refresh.test.ts
 */

import { afterEach, expect, test, vi } from "vitest";
import { InngestTestEngine } from "@inngest/test";
import { serverDb } from "@/lib/db/client";
import type { weeklyRefresh as WeeklyRefreshFn } from "@/lib/inngest/functions/weekly-refresh";
import type { PreliminaryFacts, WatermarkBody } from "@/lib/scan/types";
import type { Json } from "@/lib/db/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function makeFacts(): PreliminaryFacts {
  return {
    mode: "ios",
    listing: { name: "HabitKit", category: "Health & Fitness", description: "Build habits" },
    competitors: [
      { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: "Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    reviewVolume: 1500,
    ratingTrend: 4.6,
    webProxy: null,
    themes: [{ term: "streaks", count: 38 }],
    sourcesUsed: ["app_store_rss", "itunes", "dataforseo_serp"],
    coldStart: false,
  };
}

// Stale watermarks → the fixture deltas fire on the first run (non-empty).
function staleWatermarks(): Record<string, WatermarkBody> {
  return {
    reviews: { lastReviewId: "rk-old-id" },
    rank: { topRanks: { "habit tracker app": 99 } },
    threads: { lastThreadAt: "2000-01-01T00:00:00Z" },
    competitors: { knownCompetitors: ["Habitify"] },
  };
}

/** Seed an app + a latest (done) scan + 4 monitors. Returns ids. */
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

/** Seed a user owning `appIds` with the given tier + subscription status. */
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
      email: `weekly-refresh-${suffix}@example.com`,
      tier,
      subscription_status: subscriptionStatus,
      app_ids: appIds,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test(
  "weeklyRefresh (fixtures): refreshes paid app (snapshot + refresh event), skips free app, idempotent within the week",
  async () => {
    // Force fixtures mode before importing the function (the env Proxy memoizes
    // on first read, so reset modules + stub + dynamic import, à la refresh.test.ts).
    vi.resetModules();
    vi.stubEnv("REACHKIT_USE_FIXTURES", "true");
    const { weeklyRefresh }: { weeklyRefresh: typeof WeeklyRefreshFn } = await import(
      "@/lib/inngest/functions/weekly-refresh"
    );

    const db = serverDb();
    const stamp = Date.now();

    // Paid app (solo + active) and free app (free tier).
    const paid = await seedApp(`https://apps.apple.com/us/app/habitkit/id${stamp}-paid`);
    const free = await seedApp(`https://apps.apple.com/us/app/habitkit/id${stamp}-free`);

    await seedUser(`paid-${stamp}`, "solo", "active", [paid.appId]);
    await seedUser(`free-${stamp}`, "free", null, [free.appId]);

    // Run the real cron function via InngestTestEngine.
    const engine = new InngestTestEngine({ function: weeklyRefresh });
    const { result } = await engine.execute({
      events: [{ name: "inngest/scheduled.timer", data: { cron: "0 9 * * 1" } }],
    });

    // The run summarises how many apps it processed.
    expect(result).toMatchObject({ refreshed: expect.any(Number) });

    // --- PAID app refreshed: a score_snapshots row exists. ---
    const { data: paidSnaps, error: paidSnapErr } = await db
      .from("score_snapshots")
      .select("id, total")
      .eq("app_id", paid.appId);
    expect(paidSnapErr).toBeNull();
    expect((paidSnaps ?? []).length).toBe(1);

    // --- PAID app refreshed: a `refresh` scan_event on the latest scan id. ---
    const { data: paidEvents, error: paidEvtErr } = await db
      .from("scan_events")
      .select("type, payload, scan_id")
      .eq("scan_id", paid.scanId)
      .eq("type", "refresh");
    expect(paidEvtErr).toBeNull();
    expect((paidEvents ?? []).length).toBe(1);
    const evt = paidEvents?.[0];
    if (!evt) throw new Error("no refresh event for paid app");
    const payload = evt.payload as Record<string, unknown>;
    expect(payload).toHaveProperty("weekOf");
    expect(payload).toHaveProperty("changes");

    // --- FREE app NOT refreshed: no snapshot, no refresh event. ---
    const { data: freeSnaps } = await db
      .from("score_snapshots")
      .select("id")
      .eq("app_id", free.appId);
    expect((freeSnaps ?? []).length).toBe(0);

    const { data: freeEvents } = await db
      .from("scan_events")
      .select("id")
      .eq("scan_id", free.scanId)
      .eq("type", "refresh");
    expect((freeEvents ?? []).length).toBe(0);

    // --- Idempotency: a 2nd run in the same ISO week skips the paid app. ---
    const engine2 = new InngestTestEngine({ function: weeklyRefresh });
    await engine2.execute({
      events: [{ name: "inngest/scheduled.timer", data: { cron: "0 9 * * 1" } }],
    });

    const { data: paidSnaps2 } = await db
      .from("score_snapshots")
      .select("id")
      .eq("app_id", paid.appId);
    // Still exactly one snapshot — no duplicate this week.
    expect((paidSnaps2 ?? []).length).toBe(1);
  },
  120_000,
);
